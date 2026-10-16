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
from rest_framework.exceptions import ValidationError

# Django imports
from django.utils import timezone

# Module imports
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import Issue, Project, State
from plane.utils.exception_logger import log_exception
from plane.utils.workflow import validate_workflow_write


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

            # Check if Issues
            if issues:
                # Set the archive time to current time
                archive_at = timezone.now().date()

                issues_to_update = []
                for issue in issues:
                    issue.archived_at = archive_at
                    issues_to_update.append(issue)

                # Bulk Update the issues and log the activity
                if issues_to_update:
                    Issue.objects.bulk_update(issues_to_update, ["archived_at"], batch_size=100)
                    _ = [
                        issue_activity.delay(
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
                        for issue in issues_to_update
                    ]
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


@transaction.atomic
def close_project_issues(project_id):
    # Serialize automation with workflow edits and interactive state changes.
    project = Project.objects.select_for_update(of=("self",)).select_related("default_state").get(pk=project_id)
    if project.close_in <= 0:
        return
    close_in = project.close_in

    # Get all the issues whose updated_at is less than the close_in days.
    issues = (
        Issue.issue_objects.select_for_update(of=("self",))
        .filter(
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
        )
        .filter(
            Q(issue_intake__status=1)
            | Q(issue_intake__status=-1)
            | Q(issue_intake__status=2)
            | Q(issue_intake__isnull=True)
        )
    )

    close_state = project.default_state
    if close_state is None or close_state.project_id != project.id or close_state.group != "cancelled":
        close_state = State.objects.filter(project_id=project_id, group="cancelled").first()
    if close_state is None:
        return
    issues_to_update = []
    for issue in issues:
        try:
            # Automated actions cannot impersonate a member on a restricted path.
            validate_workflow_write(project_id, {"state": close_state}, issue, actor=AnonymousUser())
        except ValidationError:
            continue
        issue.state = close_state
        issues_to_update.append(issue)

    # Bulk update allowed changes and log the activity.
    if issues_to_update:
        Issue.objects.bulk_update(issues_to_update, ["state"], batch_size=100)
        for issue in issues_to_update:
            transaction.on_commit(
                lambda issue=issue: issue_activity.delay(
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
