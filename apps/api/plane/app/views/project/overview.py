# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import copy
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import MethodNotAllowed, ParseError, PermissionDenied, ValidationError
from rest_framework.response import Response

from plane.app.serializers.project_overview import (
    ProjectActivitySerializer,
    ProjectLinkSerializer,
    ProjectReactionSerializer,
    ProjectUpdateCommentSerializer,
    ProjectUpdateReactionSerializer,
    ProjectUpdateSerializer,
    get_project_update_progress,
)
from plane.app.views.base import BaseAPIView
from plane.db.models import (
    Project,
    ProjectActivity,
    ProjectLink,
    ProjectMember,
    ProjectReaction,
    ProjectUpdate,
    ProjectUpdateComment,
    ProjectUpdateReaction,
    User,
    WorkspaceMember,
)


ACTIVITY_SUMMARY_LENGTH = 500
PROJECT_ACTIVITY_FIELDS = (
    "name",
    "description",
    "description_text",
    "description_html",
    "cover_image",
    "cover_image_asset",
    "logo_props",
    "emoji",
    "icon_prop",
    "status",
    "priority",
    "project_lead",
    "labels",
    "start_date",
    "target_date",
)


def record_project_activity(project, actor: User, verb, field, old_value=None, new_value=None):
    """Write alongside the caller's mutation so failure rolls back both records."""
    activity = ProjectActivity(
        project=project,
        actor=actor,
        verb=verb,
        field=field,
        old_value=old_value,
        new_value=new_value,
        created_by=actor,
    )
    activity.save(disable_auto_set_user=True)
    return activity


def snapshot_project_fields(project):
    values = {}
    for field in PROJECT_ACTIVITY_FIELDS:
        if field == "labels":
            values[field] = sorted(str(pk) for pk in project.labels.values_list("id", flat=True))
        else:
            model_field = project._meta.get_field(field)
            values[field] = copy.deepcopy(getattr(project, model_field.attname))
    return json.loads(json.dumps(values, cls=DjangoJSONEncoder))


def _activity_value(value):
    # Rich descriptions can be large JSON documents. Retain a bounded readable
    # summary in the event, while comparing the full snapshots for true changes.
    if isinstance(value, str):
        return value[:ACTIVITY_SUMMARY_LENGTH]
    if isinstance(value, (dict, list)) and len(json.dumps(value, ensure_ascii=False)) > ACTIVITY_SUMMARY_LENGTH:
        return json.dumps(value, ensure_ascii=False)[:ACTIVITY_SUMMARY_LENGTH]
    return value


def record_project_field_changes(project, actor: User, before):
    after = snapshot_project_fields(project)
    for field, old_value in before.items():
        if old_value != after[field]:
            record_project_activity(
                project, actor, "updated", field, _activity_value(old_value), _activity_value(after[field])
            )


def get_project_overview_access(user, slug, project_id, for_update=False):
    projects = Project.objects.select_related("workspace").filter(
        workspace__slug=slug, workspace__deleted_at__isnull=True
    )
    if for_update:
        projects = projects.select_for_update(of=("self",))
    project = get_object_or_404(projects, pk=project_id)
    workspace_member = WorkspaceMember.objects.filter(
        workspace_id=project.workspace_id, member=user, member__is_active=True, is_active=True
    ).first()
    project_member = ProjectMember.objects.filter(
        project=project, workspace_id=project.workspace_id, member=user, is_active=True
    ).first()
    if not workspace_member or not project_member:
        raise PermissionDenied("Active workspace and project membership is required.")
    if for_update and project.archived_at:
        raise ValidationError("Archived projects are read-only.")
    return project, project_member, workspace_member


class ProjectOverviewResourceEndpoint(BaseAPIView):
    model = None
    serializer_class = None
    activity_field = None
    feature_property = None

    def check_feature_enabled(self, project):
        if self.feature_property and not getattr(project, self.feature_property):
            raise PermissionDenied("Project updates are disabled. Enable them in project settings.")

    def get_resources(self, project):
        return self.model.objects.filter(project=project, workspace_id=project.workspace_id).select_related(
            "created_by"
        )

    def get_resource(self, project, pk):
        return get_object_or_404(self.get_resources(project), pk=pk)

    def serialize_resource(self, resource):
        return self.serializer_class(resource).data

    def summary(self, resource):
        raise NotImplementedError

    def get(self, request, slug, project_id, pk=None):
        project, _, _ = get_project_overview_access(request.user, slug, project_id)
        if pk:
            return Response(self.serializer_class(self.get_resource(project, pk)).data)
        resources = self.get_resources(project)
        return Response(self.serializer_class(resources.order_by("-created_at", "-id"), many=True).data)

    @transaction.atomic
    def post(self, request, slug, project_id, pk=None):
        if pk:
            raise MethodNotAllowed("POST")
        project, member, workspace_member = get_project_overview_access(request.user, slug, project_id, for_update=True)
        self.check_feature_enabled(project)
        if member.role not in (15, 20) and workspace_member.role != 20:
            raise PermissionDenied("Only project members and admins can create resources.")
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        resource = serializer.save(project=project, created_by=request.user)
        record_project_activity(project, request.user, "added", self.activity_field, new_value=self.summary(resource))
        return Response(self.serialize_resource(resource), status=201)

    def check_owner(self, resource, user, member, workspace_member):
        if resource.created_by_id != user.id and member.role != 20 and workspace_member.role != 20:
            raise PermissionDenied("Only the owner or an admin can change this resource.")

    @transaction.atomic
    def patch(self, request, slug, project_id, pk=None):
        if pk is None:
            raise MethodNotAllowed("PATCH")
        project, member, workspace_member = get_project_overview_access(request.user, slug, project_id, for_update=True)
        self.check_feature_enabled(project)
        resource = self.get_resource(project, pk)
        self.check_owner(resource, request.user, member, workspace_member)
        serializer = self.serializer_class(resource, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = any(getattr(resource, key) != value for key, value in serializer.validated_data.items())
        if changed:
            before = self.summary(resource)
            resource = serializer.save(updated_by=request.user)
            record_project_activity(
                project, request.user, "updated", self.activity_field, before, self.summary(resource)
            )
        return Response(self.serialize_resource(resource))

    def put(self, request, slug, project_id, pk=None):
        return self.patch(request, slug, project_id, pk)

    @transaction.atomic
    def delete(self, request, slug, project_id, pk=None):
        if pk is None:
            raise MethodNotAllowed("DELETE")
        project, member, workspace_member = get_project_overview_access(request.user, slug, project_id, for_update=True)
        self.check_feature_enabled(project)
        resource = self.get_resource(project, pk)
        self.check_owner(resource, request.user, member, workspace_member)
        before = self.summary(resource)
        # Child endpoints always check the active parent. A synchronous soft delete
        # hides them immediately without dispatching tasks before the transaction commits.
        self.model.objects.filter(pk=resource.pk).update(deleted_at=timezone.now(), updated_by=request.user)
        record_project_activity(project, request.user, "deleted", self.activity_field, old_value=before)
        return Response(status=204)


class ProjectLinkEndpoint(ProjectOverviewResourceEndpoint):
    model = ProjectLink
    serializer_class = ProjectLinkSerializer
    activity_field = "link"

    def summary(self, resource):
        return {"id": str(resource.id), "title": resource.title, "url": resource.url[:ACTIVITY_SUMMARY_LENGTH]}


class ProjectUpdateEndpoint(ProjectOverviewResourceEndpoint):
    model = ProjectUpdate
    serializer_class = ProjectUpdateSerializer
    activity_field = "update"
    feature_property = "project_updates_view"

    def get_resources(self, project):
        return (
            super()
            .get_resources(project)
            .select_related("created_by__avatar_asset")
            .annotate(
                comment_count=Count(
                    "comments",
                    filter=Q(
                        comments__deleted_at__isnull=True,
                        comments__project=project,
                        comments__workspace_id=project.workspace_id,
                    ),
                )
            )
            .prefetch_related(
                Prefetch(
                    "reactions",
                    queryset=ProjectUpdateReaction.objects.filter(
                        project=project, workspace_id=project.workspace_id
                    ).select_related("actor__avatar_asset"),
                )
            )
        )

    def serialize_updates(self, project, updates, many=False):
        rows = list(updates) if many else [updates]
        # Historical rows use today's counts without persisting invented history.
        # One aggregate is shared across all legacy cards in this response.
        context = {}
        if any(row.progress is None for row in rows):
            context["current_progress"] = get_project_update_progress(project)
        return self.serializer_class(rows if many else updates, many=many, context=context).data

    def get(self, request, slug, project_id, pk=None):
        project, _, _ = get_project_overview_access(request.user, slug, project_id)
        if pk:
            return Response(self.serialize_updates(project, self.get_resource(project, pk)))
        resources = self.get_resources(project).order_by("-created_at", "-id")
        return Response(self.serialize_updates(project, resources, many=True))

    def serialize_resource(self, resource):
        # POST/PATCH have the same counts, reaction and actor shape as list/detail.
        return self.serialize_updates(resource.project, self.get_resource(resource.project, resource.pk))

    def summary(self, resource):
        return {"id": str(resource.id), "body": resource.body[:ACTIVITY_SUMMARY_LENGTH], "health": resource.health}


class ProjectUpdateChildEndpoint(ProjectUpdateEndpoint):
    """Share membership, feature, archive and active-parent checks for update children."""

    def get_parent(self, request, slug, project_id, pk, for_update=False):
        project, member, workspace_member = get_project_overview_access(
            request.user, slug, project_id, for_update=for_update
        )
        if for_update:
            self.check_feature_enabled(project)
        update = get_object_or_404(ProjectUpdate.objects, pk=pk, project=project, workspace_id=project.workspace_id)
        return project, update, member, workspace_member

    # Children expose their explicit verbs only, not the parent resource's PATCH/PUT.
    http_method_names = ["get", "post", "delete", "head", "options"]


class ProjectUpdateCommentEndpoint(ProjectUpdateChildEndpoint):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    @transaction.atomic
    def patch(self, request, slug, project_id, pk, comment_id=None):
        if comment_id is None:
            raise MethodNotAllowed("PATCH")
        project, update, _, _ = self.get_parent(request, slug, project_id, pk, for_update=True)
        comment = get_object_or_404(
            ProjectUpdateComment.objects.select_related("created_by__avatar_asset"),
            pk=comment_id,
            update=update,
            project=project,
            workspace_id=project.workspace_id,
        )
        if comment.created_by_id != request.user.id:
            raise PermissionDenied("Only the author can edit this comment.")
        serializer = ProjectUpdateCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if any(getattr(comment, field) != value for field, value in serializer.validated_data.items()):
            serializer.save(updated_by=request.user)
        return Response(serializer.data)

    def get(self, request, slug, project_id, pk, comment_id=None):
        if comment_id is not None:
            raise MethodNotAllowed("GET")
        project, update, _, _ = self.get_parent(request, slug, project_id, pk)
        comments = ProjectUpdateComment.objects.filter(
            update=update, project=project, workspace_id=project.workspace_id
        ).select_related("created_by__avatar_asset")
        return Response(ProjectUpdateCommentSerializer(comments, many=True).data)

    @transaction.atomic
    def post(self, request, slug, project_id, pk, comment_id=None):
        if comment_id is not None:
            raise MethodNotAllowed("POST")
        project, update, _, _ = self.get_parent(request, slug, project_id, pk, for_update=True)
        serializer = ProjectUpdateCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project, update=update, created_by=request.user)
        return Response(serializer.data, status=201)

    @transaction.atomic
    def delete(self, request, slug, project_id, pk, comment_id=None):
        if comment_id is None:
            raise MethodNotAllowed("DELETE")
        project, update, member, workspace_member = self.get_parent(request, slug, project_id, pk, for_update=True)
        comment = get_object_or_404(
            ProjectUpdateComment.objects,
            pk=comment_id,
            update=update,
            project=project,
            workspace_id=project.workspace_id,
        )
        self.check_owner(comment, request.user, member, workspace_member)
        ProjectUpdateComment.objects.filter(pk=comment.pk).update(deleted_at=timezone.now(), updated_by=request.user)
        return Response(status=204)


class ProjectUpdateReactionEndpoint(ProjectUpdateChildEndpoint):
    http_method_names = ["post", "delete", "options"]

    @transaction.atomic
    def post(self, request, slug, project_id, pk):
        project, update, _, _ = self.get_parent(request, slug, project_id, pk, for_update=True)
        serializer = ProjectUpdateReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reaction = ProjectUpdateReaction.objects.filter(
            update=update,
            project=project,
            workspace_id=project.workspace_id,
            actor=request.user,
            reaction=serializer.validated_data["reaction"],
        ).first()
        created = reaction is None
        if created:
            reaction = serializer.save(project=project, update=update, actor=request.user, created_by=request.user)
        return Response(ProjectUpdateReactionSerializer(reaction).data, status=201 if created else 200)

    @transaction.atomic
    def delete(self, request, slug, project_id, pk):
        project, update, _, _ = self.get_parent(request, slug, project_id, pk, for_update=True)
        serializer = ProjectUpdateReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ProjectUpdateReaction.objects.filter(
            update=update,
            project=project,
            workspace_id=project.workspace_id,
            actor=request.user,
            reaction=serializer.validated_data["reaction"],
        ).update(deleted_at=timezone.now(), updated_by=request.user)
        return Response(status=204)


class ProjectReactionEndpoint(BaseAPIView):
    def get(self, request, slug, project_id):
        project, _, _ = get_project_overview_access(request.user, slug, project_id)
        reactions = ProjectReaction.objects.filter(project=project, workspace_id=project.workspace_id).select_related(
            "actor"
        )
        return Response(ProjectReactionSerializer(reactions.order_by("-created_at", "-id"), many=True).data)

    @transaction.atomic
    def post(self, request, slug, project_id):
        project, _, _ = get_project_overview_access(request.user, slug, project_id, for_update=True)
        serializer = ProjectReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reaction = ProjectReaction.objects.filter(
            project=project, actor=request.user, reaction=serializer.validated_data["reaction"]
        ).first()
        created = reaction is None
        if created:
            reaction = ProjectReaction(
                project=project,
                actor=request.user,
                reaction=serializer.validated_data["reaction"],
                created_by=request.user,
            )
            reaction.save(disable_auto_set_user=True)
            record_project_activity(
                project, request.user, "added", "reaction", new_value={"reaction": reaction.reaction}
            )
        return Response(ProjectReactionSerializer(reaction).data, status=201 if created else 200)

    @transaction.atomic
    def delete(self, request, slug, project_id):
        project, _, _ = get_project_overview_access(request.user, slug, project_id, for_update=True)
        serializer = ProjectReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reaction = ProjectReaction.objects.filter(
            project=project,
            workspace_id=project.workspace_id,
            actor=request.user,
            reaction=serializer.validated_data["reaction"],
        ).first()
        if reaction:
            ProjectReaction.objects.filter(pk=reaction.pk).update(deleted_at=timezone.now(), updated_by=request.user)
            record_project_activity(
                project, request.user, "deleted", "reaction", old_value={"reaction": reaction.reaction}
            )
        return Response(status=204)


class ProjectActivityEndpoint(BaseAPIView):
    def get(self, request, slug, project_id):
        project, _, _ = get_project_overview_access(request.user, slug, project_id)
        if self.get_per_page(request, default_per_page=50, max_per_page=100) < 1:
            raise ParseError("per_page must be positive.")
        order_by = request.query_params.get("order_by", "-created_at")
        if order_by not in ("-created_at", "created_at"):
            raise ParseError("order_by must be '-created_at' or 'created_at'.")
        id_order = "-id" if order_by.startswith("-") else "id"
        activities = ProjectActivity.objects.filter(project=project, workspace_id=project.workspace_id).select_related(
            "actor"
        )
        return self.paginate(
            request=request,
            queryset=activities.order_by(order_by, id_order),
            # OffsetPaginator's order_by would replace this stable two-field ordering.
            order_by=None,
            on_results=lambda rows: ProjectActivitySerializer(rows, many=True).data,
            default_per_page=50,
            max_per_page=100,
        )
