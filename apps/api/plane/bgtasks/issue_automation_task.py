# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json
from datetime import timedelta

# Third party imports
from celery import shared_task
from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import APIException

# Django imports
from django.utils import timezone

# Module imports
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, Project, State
from plane.services.workflow_lifecycle import workflow_lifecycle_change
from plane.utils.exception_logger import log_exception
from plane.utils.workflow import prepare_workflow_write, verify_workflow_write, finish_workflow_write


@shared_task
def archive_and_close_old_issues():
    archive_old_issues()
    close_old_issues()


def archive_old_issues():
    try:
        # Get all the projects whose archive_in is greater than 0
        projects = Project.objects.filter(archive_in__gt=0)

        for project in projects:
            project_id = project.id
            archive_in = project.archive_in

            # Get all the issues whose updated_at in less that the archive_in days
            issues = Issue.issue_objects.filter(
                Q(
                    project=project_id,
                    archived_at__isnull=True,
                    updated_at__lte=(timezone.now() - timedelta(days=archive_in)),
                    state__group__in=["completed", "cancelled"],
                ),
                Q(issue_cycle__isnull=True)
                | (Q(issue_cycle__cycle__end_date__lt=timezone.now()) & Q(issue_cycle__isnull=False)),
                Q(issue_module__isnull=True)
                | (Q(issue_module__module__target_date__lt=timezone.now()) & Q(issue_module__isnull=False)),
            ).filter(
                Q(issue_intake__status=1)
                | Q(issue_intake__status=-1)
                | Q(issue_intake__status=2)
                | Q(issue_intake__isnull=True)
            )

            with workflow_lifecycle_change(
                Project.objects.filter(pk=project_id),
                reason="issue_archived",
                issue_ids=issues.values_list("id", flat=True),
            ) as invalidate:
                archive_at = timezone.now().date()
                issues_to_update = list(issues.distinct())
                for issue in issues_to_update:
                    issue.archived_at = archive_at
                if issues_to_update:
                    Issue.objects.bulk_update(issues_to_update, ["archived_at"], batch_size=100)
                    invalidate()
                    for issue in issues_to_update:
                        transaction.on_commit(
                            lambda issue=issue,
                            project=project,
                            archive_at=archive_at,
                            project_id=project_id: issue_activity.delay(
                                type="issue.activity.updated",
                                requested_data=json.dumps({"archived_at": str(archive_at), "automation": True}),
                                actor_id=str(project.created_by_id),
                                issue_id=issue.id,
                                project_id=project_id,
                                current_instance=json.dumps({"archived_at": None}),
                                subscriber=False,
                                epoch=int(timezone.now().timestamp()),
                                notification=True,
                            )
                        )
        return
    except Exception as e:
        log_exception(e)
        return


def close_old_issues():
    try:
        for project_id in Project.objects.filter(close_in__gt=0).values_list("id", flat=True):
            close_project_issues(project_id)
        return
    except Exception as e:
        log_exception(e)
        return


def close_project_issues(project_id):
    project = Project.objects.select_related("default_state").get(pk=project_id)
    if project.close_in <= 0:
        return
    close_in = project.close_in

    # Get all the issues whose updated_at is less than the close_in days.
    issues = Issue.issue_objects.filter(
        Q(
            project=project_id,
            archived_at__isnull=True,
            updated_at__lte=(timezone.now() - timedelta(days=close_in)),
            state__group__in=["backlog", "unstarted", "started"],
        ),
        Q(issue_cycle__isnull=True)
        | (Q(issue_cycle__cycle__end_date__lt=timezone.now()) & Q(issue_cycle__isnull=False)),
        Q(issue_module__isnull=True)
        | (Q(issue_module__module__target_date__lt=timezone.now()) & Q(issue_module__isnull=False)),
    ).filter(
        Q(issue_intake__status=1)
        | Q(issue_intake__status=-1)
        | Q(issue_intake__status=2)
        | Q(issue_intake__isnull=True)
    )

    close_state = project.default_state
    if close_state is None or close_state.project_id != project.id or close_state.group != "cancelled":
        close_state = State.objects.filter(project_id=project_id, group="cancelled").first()
    if close_state is None:
        return
    actor = AnonymousUser()
    for issue in issues.distinct():
        try:
            # Runner pre steps execute before acquiring project or issue locks.
            attrs = {"state": close_state}
            prepared = prepare_workflow_write(project_id, attrs, issue, actor=actor)
            with transaction.atomic():
                current_project = Project.objects.select_for_update().get(pk=project_id)
                if current_project.close_in != close_in or current_project.default_state_id != project.default_state_id:
                    continue
                current_issue = issues.select_for_update(of=("self",)).filter(pk=issue.pk).first()
                if current_issue is None or current_issue.updated_at != issue.updated_at:
                    continue
                verify_workflow_write(prepared, current_issue, actor=actor)
                current_issue.state = attrs["state"]
                current_issue.save()
                finish_workflow_write(prepared, current_issue, actor=actor)
                transaction.on_commit(
                    lambda issue=current_issue: issue_activity.delay(
                        type="issue.activity.updated",
                        requested_data=json.dumps({"closed_to": str(issue.state_id)}),
                        actor_id=str(project.created_by_id),
                        issue_id=issue.id,
                        project_id=project_id,
                        current_instance=None,
                        subscriber=False,
                        epoch=int(timezone.now().timestamp()),
                        notification=True,
                    )
                )
        except APIException:
            # A blocked or stale automation must not stop other eligible work items.
            continue
