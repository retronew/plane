import hmac

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from plane.app.serializers.page import PageBinaryUpdateSerializer
from plane.app.views.base import BaseAPIView
from plane.app.views.issue.collaboration import DocumentWriteSerializer
from plane.bgtasks.page_transaction_task import page_transaction
from plane.db.models import Page, PageDescriptionDocument, ProjectMember, User
from plane.services.collaboration_history import save_collaboration_history
from plane.services.issue_description import collaboration_projection, DescriptionConflict
from plane.services.page_description import page_description_hash, page_document_payload


class PageDocumentWriteSerializer(DocumentWriteSerializer):
    name = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False, max_length=255)


def page_access(page, user, project_id):
    role = (
        ProjectMember.objects.filter(project_id=project_id, workspace_id=page.workspace_id, member=user, is_active=True)
        .values_list("role", flat=True)
        .first()
    )
    can_read = bool(role) and (page.access == Page.PUBLIC_ACCESS or page.owned_by_id == user.pk)
    can_edit = (
        can_read and (role in [15, 20] or page.owned_by_id == user.pk) and not page.is_locked and not page.archived_at
    )
    return can_read, can_edit


class PageCollaborationEndpoint(BaseAPIView):
    def get_page(self, request, slug, project_id, page_id):
        page = get_object_or_404(
            Page.objects,
            pk=page_id,
            workspace__slug=slug,
            project_pages__project_id=project_id,
            project_pages__deleted_at__isnull=True,
            project_pages__project__archived_at__isnull=True,
        )
        can_read, can_edit = page_access(page, request.user, project_id)
        if not can_read:
            raise PermissionDenied()
        return page, can_edit

    def get(self, request, slug, project_id, page_id):
        with transaction.atomic():
            Page.objects.select_for_update().filter(pk=page_id).first()
            page, can_edit = self.get_page(request, slug, project_id, page_id)
            document = PageDescriptionDocument.objects.filter(page=page).first()
            return Response(page_document_payload(page, document, can_edit))

    def post(self, request, slug, project_id, page_id):
        return self.write(request, slug, project_id, page_id, initializing=True)

    def patch(self, request, slug, project_id, page_id):
        return self.write(request, slug, project_id, page_id, initializing=False)

    def write(self, request, slug, project_id, page_id, initializing):
        secret = settings.LIVE_SERVER_SECRET_KEY
        if not secret or not hmac.compare_digest(request.headers.get("live-server-secret-key", ""), secret):
            raise PermissionDenied("Live service credentials required")
        payload = PageDocumentWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        with transaction.atomic():
            Page.objects.select_for_update().filter(pk=page_id).first()
            page, can_edit = self.get_page(request, slug, project_id, page_id)
            if not initializing and not can_edit:
                raise PermissionDenied()
            document, _ = PageDescriptionDocument.objects.get_or_create(page=page)
            if document.epoch != data["epoch"] or document.revision != data["revision"]:
                raise DescriptionConflict(document)
            if initializing:
                if document.state is not None or data.get("source_hash") != page_description_hash(page):
                    raise DescriptionConflict(document)
            else:
                if document.state is None:
                    raise DescriptionConflict(document)
                if "description_html" not in data or "name" not in data:
                    raise serializers.ValidationError("name and description_html are required")
                contributors = set(data.get("contributors", [])) | {request.user.pk}
                users = list(User.objects.filter(pk__in=contributors, is_active=True))
                project_ids = list(
                    page.project_pages.filter(deleted_at__isnull=True, project__archived_at__isnull=True).values_list(
                        "project_id", flat=True
                    )
                )
                if len(users) != len(contributors) or any(
                    not any(page_access(page, user, scope)[1] for scope in project_ids) for user in users
                ):
                    raise PermissionDenied("A contributor no longer has editing permission")
                previous_html = page.description_html
                serializer = PageBinaryUpdateSerializer(
                    page, data={"description_html": data["description_html"]}, partial=True
                )
                serializer.is_valid(raise_exception=True)
                token = collaboration_projection.set(True)
                try:
                    page.name = data["name"]
                    page = serializer.save()
                finally:
                    collaboration_projection.reset(token)
                document.contributors = sorted(str(user_id) for user_id in contributors)
                if previous_html != page.description_html:
                    # Persist the precise snapshot in this transaction, never read a later edit in a task.
                    save_collaboration_history(page, request.user.pk, page=True)
                    current_html = page.description_html
                    transaction.on_commit(
                        lambda: page_transaction.delay(
                            new_description_html=current_html, old_description_html=previous_html, page_id=page_id
                        )
                    )
            document.state = data["state"]
            document.revision += 1
            document.source_hash = page_description_hash(page)
            document.save()
            return Response(page_document_payload(page, document, can_edit))
