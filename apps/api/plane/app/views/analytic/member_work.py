from collections import defaultdict
from datetime import date
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Case, CharField, Count, Exists, F, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.app.views.issue.comment_review import comment_fingerprint
from plane.db.models import Issue, IssueAssignee, IssueCommentReview, Project, ProjectMember, WorkspaceMember
from plane.utils.date_utils import get_analytics_filters


COUNTS = (
    "assigned",
    "unstarted",
    "started",
    "completed",
    "cancelled",
    "overdue",
    "late_completed",
    "justified",
    "unjustified",
    "unreviewed",
)
DETAIL_STATUSES = {"all", "overdue", "late_completed", "justified", "unjustified", "unreviewed"}


def member_work_scope(request, slug):
    selected = request.GET.get("project_ids")
    try:
        if selected:
            for value in selected.split(","):
                UUID(value)
        start, end = request.GET.get("start_date"), request.GET.get("end_date")
        if start is not None or end is not None:
            if not start or not end:
                raise ValueError
            first, last = date.fromisoformat(start), date.fromisoformat(end)
            if first.isoformat() != start or last.isoformat() != end or first > last:
                raise ValueError
    except (ValueError, TypeError):
        raise ValidationError("Invalid project IDs or date range; use YYYY-MM-DD for both dates.")
    filters = get_analytics_filters(slug, request.user, "analytics", project_ids=selected)
    projects = list(
        Project.objects.filter(**filters["project_filters"], project_projectmember__deleted_at__isnull=True)
        .distinct()
        .order_by("name", "id")
    )
    ids = [p.id for p in projects]
    issues = Issue.issue_objects.filter(workspace__slug=slug, project_id__in=ids)
    # Workspace membership does not upgrade a guest's project-level issue visibility.
    restricted = ProjectMember.objects.filter(
        project_id__in=ids,
        member=request.user,
        is_active=True,
        role=ROLE.GUEST.value,
        project__guest_view_all_features=False,
    ).values("project_id")
    issues = issues.exclude(Q(project_id__in=restricted) & ~Q(created_by=request.user))
    if start:
        issues = issues.filter(target_date__gte=first, target_date__lte=last)
    events = (
        IssueCommentReview.objects.filter(issue_id=OuterRef("pk"))
        .annotate(
            current_fingerprint=comment_fingerprint("comment__"),
        )
        .annotate(
            effective_status=Case(
                When(
                    comment__isnull=False,
                    comment__deleted_at__isnull=True,
                    comment__issue_id=F("issue_id"),
                    comment__project_id=F("issue__project_id"),
                    content_fingerprint=F("current_fingerprint"),
                    then=F("status"),
                ),
                default=Value("unreviewed"),
                output_field=CharField(),
            )
        )
    )
    issues = issues.annotate(
        reason_status=Coalesce(Subquery(events.values("effective_status")[:1]), Value("unreviewed")),
        reason_comment_id=Subquery(events.values("comment_id")[:1]),
    )
    overdue, late = Q(pk__in=[]), Q(pk__in=[])
    now = timezone.now()
    for project in projects:
        try:
            tz = ZoneInfo(project.timezone or "UTC")
        except (ZoneInfoNotFoundError, ValueError):
            # Legacy rows can bypass choices validation; use the model's UTC default.
            tz = ZoneInfo("UTC")
        overdue |= Q(project_id=project.id, target_date__lt=now.astimezone(tz).date()) & ~Q(
            state__group__in=["completed", "cancelled"]
        )
        # SQL conversion uses the project's calendar date, including DST boundaries.
        issues = issues.alias(**{f"completed_date_{project.id.hex}": TruncDate("completed_at", tzinfo=tz)})
        late |= Q(
            project_id=project.id,
            state__group="completed",
            **{f"completed_date_{project.id.hex}__gt": F("target_date")},
        )
    subsets = {
        "assigned": issues,
        "unstarted": issues.filter(state__group__in=["backlog", "unstarted"]),
        **{s: issues.filter(state__group=s) for s in ("started", "completed", "cancelled")},
        "overdue": issues.filter(overdue),
        "late_completed": issues.filter(late),
        **{s: issues.filter(reason_status=s) for s in ("justified", "unjustified", "unreviewed")},
    }
    active_members = WorkspaceMember.objects.filter(
        workspace__slug=slug, is_active=True, member__is_bot=False, member__is_active=True
    )
    effective_membership = ProjectMember.objects.filter(
        workspace__slug=slug,
        project_id=OuterRef("issue__project_id"),
        member_id=OuterRef("assignee_id"),
        is_active=True,
    )
    assignments = IssueAssignee.objects.filter(
        workspace__slug=slug,
        issue_id__in=issues.values("id"),
        assignee_id__in=active_members.values("member_id"),
        project_id=F("issue__project_id"),
    ).filter(Exists(effective_membership))
    return (
        projects,
        issues,
        subsets,
        assignments,
        active_members,
        {
            "start_date": start,
            "end_date": end,
            "timezone": "project",
            "basis": "target_date",
            "assignment": "current",
        },
    )


class MemberWorkEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        projects, issues, subsets, assignments, members, scope = member_work_scope(request, slug)
        memberships = ProjectMember.objects.filter(
            project_id__in=[p.id for p in projects], workspace__slug=slug, is_active=True
        )
        member_projects = defaultdict(set)
        for member_id, project_id in memberships.values_list("member_id", "project_id"):
            member_projects[member_id].add(project_id)
        counts = {
            r["assignee_id"]: r
            for r in assignments.order_by()
            .values("assignee_id")
            .annotate(
                **{
                    key: Count("issue_id", distinct=True, filter=Q(issue_id__in=query.values("id")))
                    for key, query in subsets.items()
                }
            )
        }
        rows = []
        for membership in (
            members.filter(member_id__in=member_projects)
            .select_related("member", "member__avatar_asset")
            .order_by("member__display_name", "member_id")
        ):
            user = membership.member
            participating = [{"id": str(p.id), "name": p.name} for p in projects if p.id in member_projects[user.id]]
            rows.append(
                {
                    "id": str(user.id),
                    "name": user.display_name or user.first_name,
                    "avatar_url": user.avatar_url,
                    "project_count": len(participating),
                    "projects": participating,
                    **{key: counts.get(user.id, {}).get(key, 0) for key in COUNTS},
                }
            )
        return Response({"rows": rows, "scope": scope})


class MemberWorkDetailEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug, user_id):
        try:
            UUID(user_id)
            page, size = int(request.GET.get("page", 1)), int(request.GET.get("page_size", 20))
            if page < 1 or not 1 <= size <= 100:
                raise ValueError
        except (ValueError, TypeError):
            raise ValidationError("Invalid user ID or pagination")
        selected_status = request.GET.get("status", "all")
        if selected_status not in DETAIL_STATUSES:
            raise ValidationError({"status": "Invalid status"})
        projects, issues, subsets, assignments, members, scope = member_work_scope(request, slug)
        queryset = (
            subsets["assigned" if selected_status == "all" else selected_status]
            .filter(id__in=assignments.filter(assignee_id=user_id).values("issue_id"))
            .select_related("project", "state")
            .order_by("target_date", "id")
        )
        count = queryset.count()
        results = [
            {
                "id": str(i.id),
                "name": i.name,
                "sequence_id": i.sequence_id,
                "project_id": str(i.project_id),
                "project_name": i.project.name,
                "project_identifier": i.project.identifier,
                "target_date": i.target_date,
                "completed_at": i.completed_at,
                "state_name": i.state.name if i.state else "",
                "state_group": i.state.group if i.state else "",
                "reason_status": i.reason_status,
                "reason_comment_id": str(i.reason_comment_id)
                if i.reason_comment_id and i.reason_status != "unreviewed"
                else None,
            }
            for i in queryset[(page - 1) * size : page * size]
        ]
        return Response({"results": results, "count": count, "next_page": page + 1 if page * size < count else None})
