"""Invalidate workflow decisions around explicit membership and archive/delete writes."""

from contextlib import contextmanager
from functools import wraps
from inspect import signature

from django.db import transaction
from django.db.models import F

from plane.db.models import Issue, Project
from plane.services.workflow_approval import cancel_approvals


@contextmanager
def workflow_lifecycle_change(projects, *, reason, issue_ids=None):
    """Acquire projects in a stable order before any issue/member writes."""
    with transaction.atomic():
        project_ids = list(projects.order_by("id").select_for_update(of=("self",)).values_list("id", flat=True))
        if issue_ids is not None:
            # Evaluate before the wrapped operation can soft-delete or archive its queryset.
            issue_ids = list(issue_ids)
            list(
                Issue.objects.filter(project_id__in=project_ids, pk__in=issue_ids)
                .order_by("id")
                .select_for_update(of=("self",))
                .values_list("id", flat=True)
            )

        def invalidate():
            if issue_ids is not None and not issue_ids:
                return
            Project.all_objects.filter(pk__in=project_ids).update(workflow_version=F("workflow_version") + 1)
            for project_id in project_ids:
                cancel_approvals(project_id, issue_ids=issue_ids, reason=reason)

        yield invalidate


def workflow_lifecycle_endpoint(reason, *, workspace=False, issues=False, fields=None):
    """Wrap lifecycle-only endpoints; never wrap a workflow write that executes Runner pre."""

    def decorate(method):
        method_signature = signature(method)

        @wraps(method)
        def wrapped(self, request, *args, **kwargs):
            if fields is not None and not any(field in request.data for field in fields):
                return method(self, request, *args, **kwargs)
            arguments = method_signature.bind(self, request, *args, **kwargs).arguments
            projects = Project.objects.filter(workspace__slug=arguments["slug"])
            if not workspace:
                projects = projects.filter(pk=arguments.get("project_id") or arguments["pk"])
            issue_ids = None
            if issues:
                issue_id = arguments.get("pk") or arguments.get("issue_id")
                issue_ids = [issue_id] if issue_id else request.data.get("issue_ids", [])
            with workflow_lifecycle_change(projects, reason=reason, issue_ids=issue_ids) as invalidate:
                response = method(self, request, *args, **kwargs)
                if 200 <= response.status_code < 300:
                    invalidate()
                else:
                    transaction.set_rollback(True)
                return response

        return wrapped

    return decorate
