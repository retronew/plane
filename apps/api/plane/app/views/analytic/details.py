"""Workspace analytics backed by existing project, membership and work-item records."""

from collections import Counter
from uuid import UUID

from django.db.models import Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import (
    Cycle,
    IntakeIssue,
    Issue,
    IssueAssignee,
    IssueView,
    Module,
    Project,
    ProjectMember,
    ProjectPage,
    WorkspaceMember,
)
from plane.utils.date_utils import get_analytics_filters, get_chart_period_range


class AnalyticsDetailsEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        tab = request.GET.get("type")
        if tab not in {"projects", "users", "cycles", "modules", "intake"}:
            return Response({"error": "Invalid analytics type"}, status=status.HTTP_400_BAD_REQUEST)
        selected = request.GET.get("project_ids")
        try:
            if selected:
                for project_id in selected.split(","):
                    UUID(project_id)
        except ValueError:
            return Response({"error": "Invalid project IDs"}, status=status.HTTP_400_BAD_REQUEST)
        filters = get_analytics_filters(slug, request.user, "analytics", project_ids=selected)
        self.projects = Project.objects.filter(**filters["project_filters"]).distinct()
        self.project_ids = self.projects.values("id")
        self.issues = Issue.issue_objects.filter(project_id__in=self.project_ids)
        self.intake = IntakeIssue.objects.filter(
            project_id__in=self.project_ids,
            issue__deleted_at__isnull=True,
            issue__archived_at__isnull=True,
            issue__is_draft=False,
        )
        period = get_chart_period_range(request.GET.get("date_filter"))
        if period:
            self.issues = self.issues.filter(created_at__date__gte=period[0], created_at__date__lte=period[1])
            self.intake = self.intake.filter(created_at__date__gte=period[0], created_at__date__lte=period[1])
        if tab == "projects":
            data = self.project_details()
        elif tab == "users":
            data = self.user_details(slug, bool(selected))
        elif tab in {"cycles", "modules"}:
            data = self.progress_details(tab)
        else:
            data = self.intake_details()
        return Response(data)

    def counts_by_project(self, queryset):
        return dict(queryset.order_by().values_list("project_id").annotate(count=Count("id", distinct=True)))

    def project_details(self):
        counts = {
            "work_items": self.counts_by_project(self.issues),
            "epics": self.counts_by_project(self.issues.filter(type__is_epic=True)),
            "completed": self.counts_by_project(self.issues.filter(state__group="completed")),
            "cancelled": self.counts_by_project(self.issues.filter(state__group="cancelled")),
            "members": self.counts_by_project(
                ProjectMember.objects.filter(project_id__in=self.project_ids, is_active=True, member__is_bot=False)
            ),
            "cycles": self.counts_by_project(
                Cycle.objects.filter(project_id__in=self.project_ids, archived_at__isnull=True)
            ),
            "modules": self.counts_by_project(
                Module.objects.filter(project_id__in=self.project_ids, archived_at__isnull=True)
            ),
            "pages": self.counts_by_project(
                ProjectPage.objects.filter(project_id__in=self.project_ids, page__deleted_at__isnull=True)
            ),
            "views": self.counts_by_project(IssueView.objects.filter(project_id__in=self.project_ids)),
            "intake": self.counts_by_project(self.intake),
        }
        rows = []
        for project in self.projects.select_related("status").order_by("name", "id"):
            row = {
                "id": str(project.id),
                "name": project.name,
                "project_id": str(project.id),
                "status": project.status.name if project.status else "",
                "status_group": project.status.group if project.status else "draft",
            }
            row.update({key: values.get(project.id, 0) for key, values in counts.items()})
            effective = row["work_items"] - row["cancelled"]
            row["completion"] = round(row["completed"] * 100 / effective) if effective else 0
            rows.append(row)
        groups = Counter(row["status"] or row["status_group"] for row in rows)
        return {
            "summary": {
                "total_projects": len(rows),
                "work_items": sum(r["work_items"] for r in rows),
                "completed": sum(r["completed"] for r in rows),
            },
            "rows": rows,
            "chart": [{"name": name, "count": count} for name, count in groups.items()],
        }

    def user_details(self, slug, project_filtered):
        members = WorkspaceMember.objects.filter(
            workspace__slug=slug, is_active=True, member__is_bot=False
        ).select_related("member")
        if project_filtered:
            members = members.filter(
                member_id__in=ProjectMember.objects.filter(project_id__in=self.project_ids, is_active=True).values(
                    "member_id"
                )
            )
        grouped = (
            IssueAssignee.objects.filter(issue_id__in=self.issues.values("id"))
            .order_by()
            .values("assignee_id")
            .annotate(
                started=Count("issue_id", filter=Q(issue__state__group="started"), distinct=True),
                unstarted=Count("issue_id", filter=Q(issue__state__group__in=["backlog", "unstarted"]), distinct=True),
                completed=Count("issue_id", filter=Q(issue__state__group="completed"), distinct=True),
                cancelled=Count("issue_id", filter=Q(issue__state__group="cancelled"), distinct=True),
            )
        )
        counts = {row["assignee_id"]: row for row in grouped}
        rows = []
        roles = Counter()
        for membership in members.order_by("member__display_name", "member_id"):
            roles[membership.role] += 1
            counts_row = counts.get(membership.member_id, {})
            rows.append(
                {
                    "id": str(membership.member_id),
                    "name": membership.member.display_name or membership.member.first_name,
                    **{key: counts_row.get(key, 0) for key in ["started", "unstarted", "completed", "cancelled"]},
                }
            )
        unassigned = self.issues.exclude(issue_assignee__deleted_at__isnull=True, issue_assignee__isnull=False)
        if unassigned.exists():
            rows.append(
                {
                    "id": "unassigned",
                    "name": "",
                    "started": unassigned.filter(state__group="started").count(),
                    "unstarted": unassigned.filter(state__group__in=["backlog", "unstarted"]).count(),
                    "completed": unassigned.filter(state__group="completed").count(),
                    "cancelled": unassigned.filter(state__group="cancelled").count(),
                }
            )
        return {
            "summary": {
                "total_users": sum(roles.values()),
                "total_admins": roles[20],
                "total_members": roles[15],
                "total_guests": roles[5],
                "unique_work_items": self.issues.count(),
            },
            "rows": rows,
            "chart": [
                {
                    "name": r["name"],
                    "id": r["id"],
                    "pending": r["started"] + r["unstarted"],
                    "completed": r["completed"],
                    "cancelled": r["cancelled"],
                    "count": r["started"] + r["unstarted"] + r["completed"] + r["cancelled"],
                }
                for r in rows
            ],
        }

    def progress_details(self, tab):
        is_cycle = tab == "cycles"
        relation = "issue_cycle" if is_cycle else "issue_module"
        key = f"{relation}__{'cycle' if is_cycle else 'module'}_id"
        grouped = (
            self.issues.filter(**{f"{relation}__deleted_at__isnull": True})
            .order_by()
            .values(key)
            .annotate(
                work_items=Count("id", distinct=True),
                completed=Count("id", filter=Q(state__group="completed"), distinct=True),
                cancelled=Count("id", filter=Q(state__group="cancelled"), distinct=True),
            )
        )
        counts = {row[key]: row for row in grouped if row[key]}
        entities = (Cycle if is_cycle else Module).objects.filter(
            project_id__in=self.project_ids, archived_at__isnull=True
        )
        entities = entities.select_related("project", "owned_by" if is_cycle else "lead").order_by("name", "id")
        rows, statuses = [], Counter()
        today = timezone.localdate()
        for entity in entities:
            start = entity.start_date.date() if is_cycle and entity.start_date else entity.start_date
            end = (
                entity.end_date.date() if is_cycle and entity.end_date else entity.target_date if not is_cycle else None
            )
            state = (
                (
                    "completed"
                    if end and end < today
                    else "upcoming"
                    if start and start > today
                    else "current"
                    if start and end and start <= today <= end
                    else "unscheduled"
                )
                if is_cycle
                else entity.status
            )
            statuses[state] += 1
            item = counts.get(entity.id, {})
            total, completed = item.get("work_items", 0), item.get("completed", 0)
            cancelled = item.get("cancelled", 0)
            effective = total - cancelled
            lead = entity.owned_by if is_cycle else entity.lead
            rows.append(
                {
                    "id": str(entity.id),
                    "name": entity.name,
                    "project_id": str(entity.project_id),
                    "project": entity.project.name,
                    "lead": (lead.display_name or lead.first_name) if lead else "",
                    "start_date": start,
                    "end_date": end,
                    "status": state,
                    "work_items": total,
                    "completed": completed,
                    "cancelled": cancelled,
                    "completion": round(completed * 100 / effective) if effective else 0,
                }
            )
        keys = ["current", "upcoming", "completed"] if is_cycle else ["completed", "in-progress", "planned", "paused"]
        return {
            "summary": {f"total_{tab}": len(rows), **{key: statuses[key] for key in keys}},
            "rows": rows,
            "chart": [
                {
                    "name": r["name"],
                    "count": r["work_items"],
                    "completed": r["completed"],
                    "pending": r["work_items"] - r["completed"] - r["cancelled"],
                    "cancelled": r["cancelled"],
                }
                for r in rows
            ],
        }

    def intake_details(self):
        grouped = list(
            self.intake.order_by()
            .values("project_id", "project__name")
            .annotate(
                pending=Count("id", filter=Q(status=-2)),
                snoozed=Count("id", filter=Q(status=0)),
                accepted=Count("id", filter=Q(status=1)),
                rejected=Count("id", filter=Q(status=-1)),
                duplicate=Count("id", filter=Q(status=2)),
                total=Count("id"),
            )
        )
        rows = [
            {
                "id": str(r["project_id"]),
                "name": r["project__name"],
                "project_id": str(r["project_id"]),
                **{k: r[k] for k in ["pending", "snoozed", "accepted", "rejected", "duplicate", "total"]},
            }
            for r in grouped
        ]
        summary = self.intake.aggregate(
            total_intake=Count("id"),
            pending=Count("id", filter=Q(status=-2)),
            snoozed=Count("id", filter=Q(status=0)),
            accepted=Count("id", filter=Q(status=1)),
            rejected=Count("id", filter=Q(status=-1)),
            duplicate=Count("id", filter=Q(status=2)),
        )
        chart = list(
            self.intake.annotate(month=TruncMonth("created_at"))
            .order_by("month")
            .values("month")
            .annotate(
                accepted=Count("id", filter=Q(status=1)),
                rejected=Count("id", filter=Q(status=-1)),
                pending=Count("id", filter=Q(status=-2)),
                snoozed=Count("id", filter=Q(status=0)),
                duplicate=Count("id", filter=Q(status=2)),
                count=Count("id"),
            )
        )
        return {
            "summary": summary,
            "rows": rows,
            "chart": [
                {
                    "name": r["month"].strftime("%Y-%m"),
                    **{k: r[k] for k in ["pending", "snoozed", "accepted", "rejected", "duplicate", "count"]},
                }
                for r in chart
            ],
        }
