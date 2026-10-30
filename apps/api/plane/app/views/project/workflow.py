from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.db.models import Issue, IssueType, Project, ProjectIssueType, ProjectMember, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowActivity, WorkflowTransition
from plane.services.workflow import (
    apply_migration,
    bump_policy,
    preview_migration,
    record_workflow_activity,
    workflow_issues,
)
from plane.services.workflow_approval import cancel_approvals, sync_issue_approval, transition_snapshot
from plane.utils.workflow import (
    effective_creation_state,
    eligible_workflow_members,
    resolve_issue_workflow,
    workflow_conflict,
    workflow_error,
    workflow_states,
)


class WorkflowPatchSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)
    initial_state_id = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(required=False, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    version = serializers.IntegerField(required=False, min_value=0)
    state_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_empty=False)


class CreationPolicySerializer(serializers.Serializer):
    state_id = serializers.UUIDField()
    allow_creation = serializers.BooleanField()
    version = serializers.IntegerField(required=False, min_value=0)


class TransitionSerializer(serializers.Serializer):
    source_id = serializers.UUIDField()
    destination_id = serializers.UUIDField()
    member_ids = serializers.ListField(child=serializers.UUIDField(), max_length=500, allow_empty=True, default=list)
    kind = serializers.ChoiceField(choices=["transition", "approval"], default="transition")
    reject_state_id = serializers.UUIDField(required=False, allow_null=True)
    approver_mode = serializers.ChoiceField(choices=["all", "explicit"], default="all")
    approver_ids = serializers.ListField(child=serializers.UUIDField(), max_length=500, allow_empty=True, default=list)
    steps = serializers.ListField(child=serializers.DictField(), max_length=50, default=list)
    version = serializers.IntegerField(required=False, min_value=0)


class MigrationSerializer(serializers.Serializer):
    operation = serializers.ChoiceField(choices=["bind_type", "states", "delete", "enable", "remove_type"])
    workflow_id = serializers.UUIDField(required=False, allow_null=True)
    type_id = serializers.UUIDField(required=False)
    state_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_empty=False)
    state_mapping = serializers.DictField(child=serializers.UUIDField(), required=False, default=dict)
    enabled = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)
    token = serializers.CharField(required=False)


class WorkflowBaseView(BaseAPIView):
    def project(self, request, slug, project_id, write=False):
        project = get_object_or_404(Project, pk=project_id, workspace__slug=slug, archived_at__isnull=True)
        workspace_member = WorkspaceMember.objects.filter(
            workspace_id=project.workspace_id, member=request.user, is_active=True
        ).first()
        member = ProjectMember.objects.filter(project=project, member=request.user, is_active=True).first()
        if not workspace_member or not member:
            raise PermissionDenied()
        can_manage = workspace_member.role == 20 or (workspace_member.role >= 15 and member.role == 20)
        if write and not can_manage:
            raise PermissionDenied()
        if write:
            project = Project.objects.select_for_update().get(pk=project.pk)
        return project, can_manage

    def workflow(self, project, workflow_id="default", create=True):
        if str(workflow_id) != "default":
            return get_object_or_404(ProjectWorkflow, project=project, pk=workflow_id)
        workflow = ProjectWorkflow.objects.filter(project=project, is_default=True).first()
        if not workflow and create:
            workflow = ProjectWorkflow.objects.create(project=project, enabled=project.workflow_enabled)
        return workflow

    def check_version(self, request, workflow, workflow_id="default", value=None):
        version = value if value is not None else request.data.get("version", request.query_params.get("version"))
        if version is None:
            if str(workflow_id) != "default":
                workflow_conflict("WORKFLOW_VERSION_REQUIRED")
            return
        try:
            if int(version) != workflow.version:
                workflow_conflict()
        except (ValueError, TypeError):
            workflow_conflict()

    def check_project_version(self, request, project):
        version = request.data.get("version", request.query_params.get("version"))
        if version is None:
            workflow_conflict("WORKFLOW_VERSION_REQUIRED")
        try:
            if int(version) != project.workflow_version:
                workflow_conflict()
        except (ValueError, TypeError):
            workflow_conflict()

    def state(self, project, pk, workflow=None):
        state = workflow_states(project.pk, workflow).filter(pk=pk).first()
        if not state:
            raise ValidationError({"state_id": "WORKFLOW_INVALID_STATE"})
        return state

    def representation(self, project, can_manage, workflow=None, legacy=False):
        restricted = set(workflow.restricted_creation_states.values_list("id", flat=True)) if workflow else set()
        groups = {"backlog": 0, "unstarted": 1, "started": 2, "completed": 3, "cancelled": 4}
        states = sorted(
            workflow_states(project.pk, workflow), key=lambda s: (groups.get(s.group, 5), s.sequence, str(s.pk))
        )
        initial = effective_creation_state(project.pk, workflow)
        rules = (
            WorkflowTransition.objects.filter(workflow=workflow)
            .select_related("source", "destination", "reject_state")
            .prefetch_related("members", "approvers")
            .order_by("id")
            if workflow
            else []
        )
        return {
            "id": "default" if legacy else (workflow.pk if workflow else None),
            "workflow_id": workflow.pk if workflow else None,
            "name": workflow.name if workflow else "Default workflow",
            "description": workflow.description if workflow else "",
            "is_default": workflow.is_default if workflow else True,
            "enabled": project.workflow_enabled if workflow else False,
            "is_active": workflow.is_active if workflow else True,
            "version": workflow.version if workflow else 0,
            "policy_version": project.workflow_version,
            "initial_state_id": workflow.initial_state_id if workflow else None,
            "effective_initial_state_id": initial.id if initial else None,
            "can_manage": can_manage,
            "state_ids": [s.id for s in states],
            "issue_type_ids": list(
                ProjectIssueType.objects.filter(workflow=workflow).values_list("issue_type_id", flat=True)
            )
            if workflow
            else [],
            "states": [
                {
                    "id": s.id,
                    "name": s.name,
                    "color": s.color,
                    "icon": s.icon,
                    "group": s.group,
                    "sequence": s.sequence,
                    "allow_creation": s.allow_new_work_items and s.id not in restricted,
                }
                for s in states
            ],
            "transitions": [
                {
                    "id": r.id,
                    "source_id": r.source_id,
                    "destination_id": r.destination_id,
                    "member_ids": list(r.members.values_list("id", flat=True)),
                    "kind": r.kind,
                    "reject_state_id": r.reject_state_id,
                    "approver_mode": r.approver_mode,
                    "approver_ids": list(r.approvers.values_list("id", flat=True)),
                    "version": r.version,
                    "steps": r.steps,
                }
                for r in rules
            ],
        }

    def types_representation(self, project):
        from plane.services.custom_properties import effective_properties

        return [
            {
                "id": b.issue_type_id,
                "project_issue_type_id": b.pk,
                "name": b.issue_type.name,
                "description": b.issue_type.description,
                "logo_props": b.issue_type.logo_props,
                "is_default": b.is_default,
                "is_active": b.issue_type.is_active,
                "level": b.level,
                "properties_count": sum(active for _, active, _ in effective_properties(project.pk, b.issue_type_id)),
                "workflow_id": b.workflow_id,
            }
            for b in ProjectIssueType.objects.filter(project=project)
            .select_related("issue_type")
            .order_by("level", "id")
        ]


class ProjectWorkflowListEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id):
        project, can_manage = self.project(request, slug, project_id)
        workflows = ProjectWorkflow.objects.filter(project=project)
        if request.query_params.get("search"):
            workflows = workflows.filter(name__icontains=request.query_params["search"])
        if request.query_params.get("state_id"):
            workflows = workflows.filter(Q(is_default=True) | Q(states=request.query_params["state_id"]))
        if request.query_params.get("type_id"):
            workflows = workflows.filter(issue_types__issue_type_id=request.query_params["type_id"])
        order = request.query_params.get("order_by", "name")
        if order not in ("name", "-name", "created_at", "-created_at", "updated_at", "-updated_at"):
            raise ValidationError({"order_by": "Invalid order"})
        workflows = workflows.distinct().order_by(order, "id")
        results = [self.representation(project, can_manage, w) for w in workflows]
        return Response(
            {
                "results": results,
                "count": len(results),
                "enabled": project.workflow_enabled,
                "policy_version": project.workflow_version,
                "can_manage": can_manage,
            }
        )

    @transaction.atomic
    def post(self, request, slug, project_id):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = WorkflowPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not data.get("name") or not data.get("state_ids"):
            raise ValidationError({"workflow": "WORKFLOW_NAME_AND_STATES_REQUIRED"})
        if "version" in data and data["version"] != project.workflow_version:
            workflow_conflict()
        if ProjectWorkflow.objects.filter(project=project, name=data["name"]).exists():
            workflow_error("WORKFLOW_DUPLICATE_NAME")
        states = [self.state(project, state_id) for state_id in set(data["state_ids"])]
        workflow = ProjectWorkflow.objects.create(
            project=project,
            name=data["name"],
            description=data.get("description", ""),
            is_default=False,
            is_active=data.get("is_active", True),
        )
        workflow.states.set(states)
        if data.get("initial_state_id"):
            workflow.initial_state = self.state(project, data["initial_state_id"], workflow)
            if not workflow.initial_state.allow_new_work_items:
                workflow_error("WORKFLOW_CREATION_NOT_ALLOWED")
            workflow.save()
        bump_policy(project)
        record_workflow_activity(
            project, workflow, "created", after={"name": workflow.name, "state_ids": [str(s.pk) for s in states]}
        )
        return Response(self.representation(project, can_manage, workflow), status=201)


class ProjectWorkflowEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id, workflow_id="default"):
        project, can_manage = self.project(request, slug, project_id)
        workflow = self.workflow(project, workflow_id, create=False)
        return Response(self.representation(project, can_manage, workflow, legacy=str(workflow_id) == "default"))

    @transaction.atomic
    def patch(self, request, slug, project_id, workflow_id="default"):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = WorkflowPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        workflow = self.workflow(project, workflow_id)
        self.check_version(request, workflow, workflow_id)
        if "state_ids" in data:
            workflow_error("WORKFLOW_PREVIEW_REQUIRED")
        if (
            "name" in data
            and ProjectWorkflow.objects.filter(project=project, name=data["name"]).exclude(pk=workflow.pk).exists()
        ):
            workflow_error("WORKFLOW_DUPLICATE_NAME")
        was_project_enabled, was_active = project.workflow_enabled, workflow.is_active
        changes = []
        if "initial_state_id" in data:
            state = self.state(project, data["initial_state_id"], workflow) if data["initial_state_id"] else None
            if state and not state.allow_new_work_items:
                workflow_error("WORKFLOW_CREATION_NOT_ALLOWED")
            if workflow.initial_state_id != (state.pk if state else None):
                before = {
                    "state": {"id": str(workflow.initial_state_id), "name": workflow.initial_state.name}
                    if workflow.initial_state_id
                    else None
                }
                workflow.initial_state = state
                if state:
                    workflow.restricted_creation_states.remove(state)
                changes.append(
                    (
                        "initial",
                        before,
                        {"state": {"id": str(state.pk), "name": state.name} if state else None},
                        {"state_name": state.name if state else ""},
                    )
                )
        for field in ("name", "description", "is_active"):
            if field in data and getattr(workflow, field) != data[field]:
                if (
                    field == "is_active"
                    and data[field]
                    and str(workflow_id) != "default"
                    and Issue.objects.filter(
                        project=project, type_id__in=workflow.issue_types.values("issue_type_id")
                    ).exists()
                ):
                    workflow_error("WORKFLOW_PREVIEW_REQUIRED")
                before = getattr(workflow, field)
                setattr(workflow, field, data[field])
                changes.append((field, {field: before}, {field: data[field]}, {"value": data[field]}))
        if "enabled" in data and project.workflow_enabled != data["enabled"]:
            if data["enabled"] and str(workflow_id) != "default" and Issue.objects.filter(project=project).exists():
                workflow_error("WORKFLOW_PREVIEW_REQUIRED")
            changes.append(
                (
                    "enabled",
                    {"enabled": project.workflow_enabled},
                    {"enabled": data["enabled"]},
                    {"value": data["enabled"]},
                )
            )
            project.workflow_enabled = data["enabled"]
            project.save(update_fields=["workflow_enabled", "updated_at"])
            ProjectWorkflow.objects.filter(project=project, is_default=True).update(enabled=project.workflow_enabled)
            if workflow.is_default:
                workflow.enabled = project.workflow_enabled
        if (
            not workflow_states(project.pk, workflow)
            .filter(allow_new_work_items=True)
            .exclude(pk__in=workflow.restricted_creation_states.values("id"))
            .exists()
        ):
            workflow_error("WORKFLOW_NO_CREATION_STATE")
        workflow.save()
        if changes:
            bump_policy(project, workflow)
            project_switch_changed = was_project_enabled != project.workflow_enabled
            if project_switch_changed:
                cancel_approvals(project.pk, reason="project_switch_changed")
            if project.workflow_enabled and (project_switch_changed or (not was_active and workflow.is_active)):
                targets = ProjectWorkflow.objects.filter(project=project) if project_switch_changed else [workflow]
                for target in targets:
                    if (
                        not workflow_states(project.pk, target)
                        .filter(allow_new_work_items=True)
                        .exclude(pk__in=target.restricted_creation_states.values("id"))
                        .exists()
                    ):
                        workflow_error("WORKFLOW_NO_CREATION_STATE")
                issues = (
                    Issue.objects.filter(project=project, is_draft=False, archived_at__isnull=True)
                    if project_switch_changed
                    else workflow_issues(project, workflow)
                )
                for issue in issues.select_for_update().order_by("id"):
                    target = resolve_issue_workflow(project.pk, issue.type_id)
                    if (
                        target
                        and target.is_active
                        and not workflow_states(project.pk, target).filter(pk=issue.state_id).exists()
                    ):
                        workflow_error("WORKFLOW_PREVIEW_REQUIRED")
                    sync_issue_approval(issue, actor=request.user)
            for action, before, after, legacy in changes:
                record_workflow_activity(project, workflow, action, before, after, **legacy)
        return Response(self.representation(project, can_manage, workflow, legacy=str(workflow_id) == "default"))

    @transaction.atomic
    def delete(self, request, slug, project_id, workflow_id="default"):
        project, _ = self.project(request, slug, project_id, write=True)
        workflow = self.workflow(project, workflow_id)
        self.check_version(request, workflow, workflow_id)
        if workflow.is_default:
            workflow_error("WORKFLOW_DEFAULT_PROTECTED")
        if workflow.issue_types.exists():
            workflow_error("WORKFLOW_PREVIEW_REQUIRED")
        record_workflow_activity(project, workflow, "deleted", before={"name": workflow.name})
        bump_policy(project, workflow)
        workflow.delete(soft=False)
        return Response(status=204)


class WorkflowCreationPolicyEndpoint(WorkflowBaseView):
    @transaction.atomic
    def patch(self, request, slug, project_id, workflow_id="default"):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = CreationPolicySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        workflow = self.workflow(project, workflow_id)
        self.check_version(request, workflow, workflow_id)
        state = self.state(project, data["state_id"], workflow)
        if not data["allow_creation"] and workflow.initial_state_id == state.pk:
            workflow_error("WORKFLOW_DEFAULT_REQUIRES_CREATION")
        was_allowed = not workflow.restricted_creation_states.filter(pk=state.pk).exists()
        if data["allow_creation"]:
            workflow.restricted_creation_states.remove(state)
        else:
            workflow.restricted_creation_states.add(state)
        if (
            not workflow_states(project.pk, workflow)
            .filter(allow_new_work_items=True)
            .exclude(pk__in=workflow.restricted_creation_states.values("id"))
            .exists()
        ):
            workflow_error("WORKFLOW_NO_CREATION_STATE")
        if was_allowed != data["allow_creation"]:
            bump_policy(project, workflow)
            record_workflow_activity(
                project,
                workflow,
                "creation",
                before={"state": {"id": str(state.pk), "name": state.name}, "allow_creation": was_allowed},
                after={"state": {"id": str(state.pk), "name": state.name}, "allow_creation": data["allow_creation"]},
                state_name=state.name,
                value=data["allow_creation"],
            )
        return Response(self.representation(project, can_manage, workflow, legacy=str(workflow_id) == "default"))


class WorkflowTransitionEndpoint(WorkflowBaseView):
    @transaction.atomic
    def post(self, request, slug, project_id, pk=None, workflow_id="default"):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = TransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        workflow = self.workflow(project, workflow_id)
        self.check_version(request, workflow, workflow_id)
        source, destination = (
            self.state(project, data["source_id"], workflow),
            self.state(project, data["destination_id"], workflow),
        )
        if source == destination:
            workflow_error("WORKFLOW_SAME_STATE")
        reject = self.state(project, data["reject_state_id"], workflow) if data.get("reject_state_id") else None
        if data["kind"] == "approval" and (not reject or reject.pk == source.pk):
            workflow_error("WORKFLOW_INVALID_APPROVAL_TARGET")
        if data["kind"] == "transition" and reject:
            workflow_error("WORKFLOW_INVALID_APPROVAL_TARGET")
        member_ids, approver_ids = set(data["member_ids"]), set(data["approver_ids"])
        eligible = set(eligible_workflow_members(project).values_list("member_id", flat=True))
        if not member_ids.issubset(eligible) or not approver_ids.issubset(eligible):
            workflow_error("WORKFLOW_INVALID_MEMBER")
        if data["kind"] == "approval" and data["approver_mode"] == "explicit" and not approver_ids:
            workflow_error("WORKFLOW_APPROVERS_REQUIRED")
        rule = get_object_or_404(WorkflowTransition, pk=pk, workflow=workflow) if pk else None
        siblings = WorkflowTransition.objects.filter(workflow=workflow, source=source)
        if rule:
            siblings = siblings.exclude(pk=rule.pk)
        if siblings.filter(destination=destination).exists():
            workflow_error("WORKFLOW_DUPLICATE_TRANSITION")
        if siblings.exclude(kind=data["kind"]).exists():
            workflow_error("WORKFLOW_MIXED_TRANSITION_KINDS")
        steps = data["steps"]
        if steps:
            from plane.utils.workflow_runner import validate_runner_steps

            steps = validate_runner_steps(project, steps)
        if any(
            step["outcome"] not in (["transition"] if data["kind"] == "transition" else ["approve", "reject"])
            for step in steps
        ):
            workflow_error("WORKFLOW_INVALID_STEP_OUTCOME")
        before = transition_snapshot(rule) if rule else None
        if not rule:
            rule = WorkflowTransition(project=project, workflow=workflow)
        else:
            rule.version += 1
        rule.source, rule.destination, rule.reject_state = source, destination, reject
        rule.kind, rule.approver_mode, rule.steps = data["kind"], data["approver_mode"], steps
        rule.save()
        rule.members.set(member_ids)
        rule.approvers.set(approver_ids if data["approver_mode"] == "explicit" else [])
        bump_policy(project, workflow)
        record_workflow_activity(
            project,
            workflow,
            "transition_updated" if pk else "transition_added",
            before,
            transition_snapshot(rule),
            source_name=source.name,
            destination_name=destination.name,
            member_ids=[str(i) for i in member_ids],
        )
        return Response(self.representation(project, can_manage, workflow, legacy=str(workflow_id) == "default"))

    patch = post

    @transaction.atomic
    def delete(self, request, slug, project_id, pk, workflow_id="default"):
        project, can_manage = self.project(request, slug, project_id, write=True)
        workflow = self.workflow(project, workflow_id)
        self.check_version(request, workflow, workflow_id)
        rule = get_object_or_404(
            WorkflowTransition.objects.select_related("source", "destination", "reject_state"), pk=pk, workflow=workflow
        )
        record_workflow_activity(
            project,
            workflow,
            "transition_deleted",
            transition_snapshot(rule),
            None,
            source_name=rule.source.name,
            destination_name=rule.destination.name,
        )
        rule.delete(soft=False)
        bump_policy(project, workflow)
        return Response(self.representation(project, can_manage, workflow, legacy=str(workflow_id) == "default"))


class WorkflowActivityEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id, workflow_id="default"):
        project, _ = self.project(request, slug, project_id)
        workflow = self.workflow(project, workflow_id, create=False)
        direction = request.query_params.get("direction", "desc")
        if direction not in ("asc", "desc"):
            raise ValidationError({"direction": "Invalid direction"})
        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
        except ValueError:
            raise ValidationError({"offset": "Invalid offset"})
        activities = WorkflowActivity.objects.filter(project=project).select_related("created_by")
        activities = (
            activities.filter(Q(workflow=workflow) | Q(workflow__isnull=True))
            if str(workflow_id) == "default"
            else activities.filter(workflow=workflow)
        )
        scope = {"project": str(project.pk), "workflow": str(workflow_id), "direction": direction}
        try:
            watermark_token = request.query_params.get("watermark")
            if watermark_token:
                watermark = signing.loads(watermark_token, salt="workflow-history")
                if watermark["scope"] != scope:
                    raise ValueError
            else:
                latest = activities.order_by("-created_at", "-id").first()
                watermark = {
                    "scope": scope,
                    "time": latest.created_at.isoformat() if latest else None,
                    "id": str(latest.pk) if latest else None,
                }
                watermark_token = signing.dumps(watermark, salt="workflow-history")
            if watermark["time"]:
                stamp = parse_datetime(watermark["time"])
                activities = activities.filter(Q(created_at__lt=stamp) | Q(created_at=stamp, id__lte=watermark["id"]))
            else:
                activities = activities.none()
            count = activities.count()
            cursor_token = request.query_params.get("cursor")
            if cursor_token:
                cursor = signing.loads(cursor_token, salt="workflow-history-cursor")
                if cursor["scope"] != scope or cursor["watermark"] != watermark_token:
                    raise ValueError
                stamp = parse_datetime(cursor["time"])
                if direction == "asc":
                    activities = activities.filter(Q(created_at__gt=stamp) | Q(created_at=stamp, id__gt=cursor["id"]))
                else:
                    activities = activities.filter(Q(created_at__lt=stamp) | Q(created_at=stamp, id__lt=cursor["id"]))
                offset = 0
        except (signing.BadSignature, ValueError, KeyError, TypeError):
            raise ValidationError({"cursor": "WORKFLOW_INVALID_CURSOR"})
        order = "" if direction == "asc" else "-"
        rows = list(activities.order_by(f"{order}created_at", f"{order}id")[offset : offset + 26])
        has_more = len(rows) > 25
        rows = rows[:25]
        next_cursor = (
            signing.dumps(
                {
                    "scope": scope,
                    "watermark": watermark_token,
                    "time": rows[-1].created_at.isoformat(),
                    "id": str(rows[-1].pk),
                },
                salt="workflow-history-cursor",
            )
            if has_more
            else None
        )
        return Response(
            {
                "count": count,
                "direction": direction,
                "watermark": watermark_token,
                "next_cursor": next_cursor,
                "next_offset": offset + 25 if has_more else None,
                "results": [
                    {
                        "id": a.pk,
                        "workflow_id": a.workflow_id,
                        "workflow_name": a.workflow_name,
                        "action": a.action,
                        "data": a.data,
                        "created_at": a.created_at,
                        "actor_id": a.created_by_id,
                        "actor_name": (a.created_by.display_name or a.created_by.first_name) if a.created_by else "",
                    }
                    for a in rows
                ],
            }
        )


class WorkflowMigrationEndpoint(WorkflowBaseView):
    @transaction.atomic
    def post(self, request, slug, project_id, apply=False):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = MigrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not apply:
            preview, *_ = preview_migration(project, serializer.validated_data)
            return Response(preview)
        preview, workflow = apply_migration(project, serializer.validated_data, request.user)
        return Response(
            {
                "applied": True,
                "policy_version": project.workflow_version,
                "affected_count": preview["affected_count"],
                "workflow": self.representation(project, can_manage, workflow) if workflow else None,
                "issue_types": self.types_representation(project),
            }
        )


class HierarchyIntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if isinstance(data, bool) or isinstance(data, float):
            self.fail("invalid")
        return super().to_internal_value(data)


class HierarchyTypeLevelSerializer(serializers.Serializer):
    type_id = serializers.UUIDField()
    level = HierarchyIntegerField(min_value=0, max_value=2147483647)


class HierarchyConfigurationSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    default_level = HierarchyIntegerField(min_value=0, max_value=2147483647)
    policy_version = HierarchyIntegerField(min_value=0)
    type_levels = HierarchyTypeLevelSerializer(many=True)
    token = serializers.CharField(required=False)
    confirm_detach = serializers.BooleanField(required=False, default=False)


class ProjectHierarchyEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id):
        from plane.services.hierarchy import hierarchy_config

        project, can_manage = self.project(request, slug, project_id)
        return Response(hierarchy_config(project, can_manage, self.types_representation(project)))

    @transaction.atomic
    def post(self, request, slug, project_id, apply=False):
        from plane.services.hierarchy import apply_hierarchy, hierarchy_config, preview_hierarchy

        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = HierarchyConfigurationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not apply:
            preview, *_ = preview_hierarchy(project, data)
            return Response(preview)
        preview, type_id_map = apply_hierarchy(project, data, request.user)
        config = hierarchy_config(project, can_manage, self.types_representation(project))
        config["type_id_map"] = type_id_map
        return Response(
            {
                "applied": True,
                "detached_count": preview["conflict_count"],
                "policy_version": project.workflow_version,
                "type_id_map": type_id_map,
                "config": config,
            }
        )


class ProjectIssueTypeEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id):
        project, can_manage = self.project(request, slug, project_id)
        results = self.types_representation(project)
        return Response(
            {
                "results": results,
                "count": len(results),
                "policy_version": project.workflow_version,
                "can_manage": can_manage,
            }
        )

    @transaction.atomic
    def post(self, request, slug, project_id):
        project, _ = self.project(request, slug, project_id, write=True)
        name = serializers.CharField(max_length=255).run_validation(request.data.get("name"))
        if ProjectIssueType.objects.filter(project=project, issue_type__name=name).exists():
            workflow_error("WORKFLOW_DUPLICATE_TYPE")
        from plane.services.hierarchy import hierarchy_error

        level = HierarchyIntegerField(min_value=0, max_value=2147483647).run_validation(
            request.data.get("level", project.hierarchy_default_level)
        )
        if project.hierarchy_enabled:
            existing_levels = set(ProjectIssueType.objects.filter(project=project).values_list("level", flat=True)) | {
                0
            }
            if level not in existing_levels and level != max(existing_levels) + 1:
                hierarchy_error("HIERARCHY_INVALID_LEVEL")
        issue_type = IssueType.objects.create(
            workspace_id=project.workspace_id,
            name=name,
            level=level,
            description=serializers.CharField(allow_blank=True).run_validation(request.data.get("description", "")),
            logo_props=serializers.JSONField().run_validation(request.data.get("logo_props", {})),
        )
        default = (
            serializers.BooleanField().run_validation(request.data.get("is_default", False))
            or not ProjectIssueType.objects.filter(project=project).exists()
        )
        if default:
            ProjectIssueType.objects.filter(project=project, is_default=True).update(is_default=False)
        workflow = self.workflow(project, request.data["workflow_id"]) if request.data.get("workflow_id") else None
        ProjectIssueType.objects.create(
            project=project, issue_type=issue_type, level=level, is_default=default, workflow=workflow
        )
        bump_policy(project)
        return Response(next(t for t in self.types_representation(project) if t["id"] == issue_type.pk), status=201)

    @transaction.atomic
    def patch(self, request, slug, project_id, type_id):
        project, _ = self.project(request, slug, project_id, write=True)
        binding = get_object_or_404(
            ProjectIssueType.objects.select_related("issue_type"), project=project, issue_type_id=type_id
        )
        self.check_project_version(request, project)
        if "workflow_id" in request.data:
            workflow_error("WORKFLOW_PREVIEW_REQUIRED")
        from plane.services.hierarchy import ensure_project_type_owned, hierarchy_error

        target_level = binding.level
        if "level" in request.data:
            target_level = HierarchyIntegerField(min_value=0, max_value=2147483647).run_validation(
                request.data["level"]
            )
            if project.hierarchy_enabled and target_level != binding.level:
                hierarchy_error("HIERARCHY_PREVIEW_REQUIRED")
        if "is_default" in request.data:
            default = serializers.BooleanField().run_validation(request.data["is_default"])
            if default:
                ProjectIssueType.objects.filter(project=project, is_default=True).update(is_default=False)
            elif binding.is_default:
                workflow_error("WORKFLOW_DEFAULT_PROTECTED")
            binding.is_default = default
        if binding.is_default and request.data.get("is_active") is not None:
            if not serializers.BooleanField().run_validation(request.data["is_active"]):
                workflow_error("WORKFLOW_DEFAULT_PROTECTED")
        type_id_map = {}
        if any(k in request.data for k in ("name", "description", "logo_props", "is_active", "level")):
            issue_type, type_id_map = ensure_project_type_owned(binding)
            binding.level = target_level
            issue_type.level = target_level
            for key in ("name", "description", "logo_props", "is_active"):
                if key in request.data:
                    field = (
                        serializers.BooleanField()
                        if key == "is_active"
                        else serializers.JSONField()
                        if key == "logo_props"
                        else serializers.CharField(max_length=255 if key == "name" else None, allow_blank=key != "name")
                    )
                    value = field.run_validation(request.data[key])
                    if (
                        key == "is_active"
                        and not value
                        and (
                            Issue.objects.filter(project=project, type=issue_type).exists()
                            or issue_type.draft_issue_type.filter(project=project).exists()
                        )
                    ):
                        workflow_error("WORKFLOW_PREVIEW_REQUIRED")
                    setattr(issue_type, key, value)
            issue_type.save()
        binding.save()
        bump_policy(project)
        result = next(t for t in self.types_representation(project) if t["id"] == binding.issue_type_id)
        result["type_id_map"] = type_id_map
        return Response(result)

    @transaction.atomic
    def delete(self, request, slug, project_id, type_id):
        project, _ = self.project(request, slug, project_id, write=True)
        binding = get_object_or_404(ProjectIssueType, project=project, issue_type_id=type_id)
        self.check_project_version(request, project)
        if binding.is_default:
            workflow_error("WORKFLOW_DEFAULT_PROTECTED")
        from plane.db.models import DraftIssue

        if (
            Issue.objects.filter(project=project, type_id=type_id).exists()
            or DraftIssue.objects.filter(project=project, type_id=type_id).exists()
        ):
            workflow_error("WORKFLOW_PREVIEW_REQUIRED")
        if project.hierarchy_enabled:
            from plane.services.hierarchy import hierarchy_error

            remaining_levels = set(
                ProjectIssueType.objects.filter(project=project).exclude(pk=binding.pk).values_list("level", flat=True)
            ) | {0}
            if project.hierarchy_default_level not in remaining_levels or sorted(remaining_levels) != list(
                range(len(remaining_levels))
            ):
                hierarchy_error("HIERARCHY_PREVIEW_REQUIRED")
        binding.delete(soft=False)
        bump_policy(project)
        return Response(status=204)
