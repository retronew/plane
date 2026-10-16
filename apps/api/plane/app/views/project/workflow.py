from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.db.models import Project, ProjectMember, State, WorkspaceMember
from plane.db.models.workflow import ProjectWorkflow, WorkflowActivity, WorkflowTransition
from plane.utils.workflow import effective_creation_state


class WorkflowPatchSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)
    initial_state_id = serializers.UUIDField(required=False, allow_null=True)


class CreationPolicySerializer(serializers.Serializer):
    state_id = serializers.UUIDField()
    allow_creation = serializers.BooleanField()


class TransitionSerializer(serializers.Serializer):
    source_id = serializers.UUIDField()
    destination_id = serializers.UUIDField()
    member_ids = serializers.ListField(child=serializers.UUIDField(), max_length=500, allow_empty=True)


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

    def workflow(self, project):
        workflow, _ = ProjectWorkflow.objects.get_or_create(
            project=project, defaults={"workspace_id": project.workspace_id}
        )
        return workflow

    def event(self, project, action, data):
        WorkflowActivity.objects.create(project=project, action=action, data=data)

    def state(self, project, pk):
        state = State.objects.filter(project=project, pk=pk, is_triage=False).first()
        if not state:
            raise ValidationError({"state_id": "WORKFLOW_INVALID_STATE"})
        return state

    def representation(self, project, can_manage):
        workflow = ProjectWorkflow.objects.filter(project=project).first()
        restricted = set(workflow.restricted_creation_states.values_list("id", flat=True)) if workflow else set()
        states = list(State.objects.filter(project=project, is_triage=False))
        initial = effective_creation_state(project.pk, workflow)
        rules = (
            WorkflowTransition.objects.filter(
                workflow=workflow, source__deleted_at__isnull=True, destination__deleted_at__isnull=True
            ).prefetch_related("members")
            if workflow
            else []
        )
        return {
            "id": "default",
            "enabled": workflow.enabled if workflow else False,
            "is_active": workflow.is_active if workflow else True,
            "initial_state_id": workflow.initial_state_id if workflow else None,
            "effective_initial_state_id": initial.id if initial else None,
            "can_manage": can_manage,
            "states": [
                {
                    "id": s.id,
                    "name": s.name,
                    "color": s.color,
                    "group": s.group,
                    "allow_creation": s.id not in restricted,
                }
                for s in states
            ],
            "transitions": [
                {
                    "id": r.id,
                    "source_id": r.source_id,
                    "destination_id": r.destination_id,
                    "member_ids": [m.id for m in r.members.all()],
                }
                for r in rules
            ],
        }


class ProjectWorkflowEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id):
        project, can_manage = self.project(request, slug, project_id)
        return Response(self.representation(project, can_manage))

    @transaction.atomic
    def patch(self, request, slug, project_id):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = WorkflowPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workflow = self.workflow(project)
        data = serializer.validated_data
        if "initial_state_id" in data:
            state = self.state(project, data["initial_state_id"]) if data["initial_state_id"] else None
            if workflow.initial_state_id != (state.id if state else None):
                workflow.initial_state = state
                if state:
                    workflow.restricted_creation_states.remove(state)
                self.event(project, "initial", {"state_name": state.name if state else ""})
        for field in ["enabled", "is_active"]:
            if field in data and getattr(workflow, field) != data[field]:
                setattr(workflow, field, data[field])
                self.event(project, field, {"value": data[field]})
        if workflow.enabled and workflow.is_active and not effective_creation_state(project.pk, workflow):
            raise ValidationError({"workflow": "WORKFLOW_NO_CREATION_STATE"})
        workflow.save()
        return Response(self.representation(project, can_manage))


class WorkflowCreationPolicyEndpoint(WorkflowBaseView):
    @transaction.atomic
    def patch(self, request, slug, project_id):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = CreationPolicySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        state = self.state(project, data["state_id"])
        workflow = self.workflow(project)
        if not data["allow_creation"] and workflow.initial_state_id == state.id:
            raise ValidationError({"workflow": "WORKFLOW_DEFAULT_REQUIRES_CREATION"})
        was_allowed = not workflow.restricted_creation_states.filter(pk=state.pk).exists()
        if data["allow_creation"]:
            workflow.restricted_creation_states.remove(state)
        else:
            workflow.restricted_creation_states.add(state)
            if (
                not State.objects.filter(project=project, is_triage=False)
                .exclude(pk__in=workflow.restricted_creation_states.values("id"))
                .exists()
            ):
                raise ValidationError({"workflow": "WORKFLOW_NO_CREATION_STATE"})
        if was_allowed != data["allow_creation"]:
            self.event(project, "creation", {"state_name": state.name, "value": data["allow_creation"]})
        return Response(self.representation(project, can_manage))


class WorkflowTransitionEndpoint(WorkflowBaseView):
    @transaction.atomic
    def post(self, request, slug, project_id, pk=None):
        project, can_manage = self.project(request, slug, project_id, write=True)
        serializer = TransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        source, destination = self.state(project, data["source_id"]), self.state(project, data["destination_id"])
        if source == destination:
            raise ValidationError({"destination_id": "WORKFLOW_SAME_STATE"})
        member_ids = set(data["member_ids"])
        members = ProjectMember.objects.filter(
            project=project,
            member_id__in=member_ids,
            is_active=True,
            role__gte=15,
            member__is_active=True,
            member__is_bot=False,
            member__member_workspace__workspace_id=project.workspace_id,
            member__member_workspace__is_active=True,
        ).values_list("member_id", flat=True)
        if set(members) != member_ids:
            raise ValidationError({"member_ids": "WORKFLOW_INVALID_MEMBER"})
        workflow = self.workflow(project)
        rule = get_object_or_404(WorkflowTransition.objects, pk=pk, workflow=workflow) if pk else None
        duplicates = WorkflowTransition.objects.filter(workflow=workflow, source=source, destination=destination)
        if rule:
            duplicates = duplicates.exclude(pk=rule.pk)
        if duplicates.exists():
            raise ValidationError({"destination_id": "WORKFLOW_DUPLICATE_TRANSITION"})
        if rule:
            rule.source, rule.destination = source, destination
            rule.save()
        else:
            rule = WorkflowTransition.objects.create(
                workflow=workflow, project=project, source=source, destination=destination
            )
        rule.members.set(member_ids)
        self.event(
            project,
            "transition_updated" if pk else "transition_added",
            {
                "source_name": source.name,
                "destination_name": destination.name,
                "member_ids": [str(i) for i in member_ids],
            },
        )
        return Response(self.representation(project, can_manage))

    patch = post

    @transaction.atomic
    def delete(self, request, slug, project_id, pk):
        project, can_manage = self.project(request, slug, project_id, write=True)
        rule = get_object_or_404(
            WorkflowTransition.objects.select_related("source", "destination"), pk=pk, project=project
        )
        self.event(
            project, "transition_deleted", {"source_name": rule.source.name, "destination_name": rule.destination.name}
        )
        rule.delete()
        return Response(self.representation(project, can_manage))


class WorkflowActivityEndpoint(WorkflowBaseView):
    def get(self, request, slug, project_id):
        project, _ = self.project(request, slug, project_id)
        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
        except ValueError:
            raise ValidationError({"offset": "Invalid offset"})
        activities = WorkflowActivity.objects.filter(project=project).select_related("created_by")
        count = activities.count()
        return Response(
            {
                "count": count,
                "next_offset": offset + 25 if count > offset + 25 else None,
                "results": [
                    {
                        "id": a.id,
                        "action": a.action,
                        "data": a.data,
                        "created_at": a.created_at,
                        "actor_id": a.created_by_id,
                        "actor_name": (a.created_by.display_name or a.created_by.first_name) if a.created_by else "",
                    }
                    for a in activities[offset : offset + 25]
                ],
            }
        )
