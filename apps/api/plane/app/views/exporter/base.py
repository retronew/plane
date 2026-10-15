# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from pathlib import PurePosixPath
from botocore.exceptions import ClientError
from plane.settings.storage import S3Storage

# Third Party imports
from rest_framework import status, serializers
from rest_framework.response import Response

from plane.app.permissions import allow_permission, ROLE
from plane.app.serializers import ExporterHistorySerializer
from plane.bgtasks.export_task import issue_export_task
from plane.db.models import ExporterHistory, Project, Workspace, Issue
from plane.utils.filters import ComplexFilterBackend, IssueFilterSet

# Module imports
from .. import BaseAPIView


class ExportIssuesEndpoint(BaseAPIView):
    filterset_class = IssueFilterSet
    model = ExporterHistory
    serializer_class = ExporterHistorySerializer

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        # Get the workspace
        workspace = Workspace.objects.get(slug=slug)

        provider = request.data.get("provider", False)
        multiple = request.data.get("multiple", False)
        project_field = serializers.ListField(child=serializers.UUIDField(), allow_empty=True)
        project_ids = [str(value) for value in project_field.run_validation(request.data.get("project", []))]
        rich_filters = request.data.get("rich_filters", {})
        ComplexFilterBackend().filter_queryset(request, Issue.objects.none(), self, filter_data=rich_filters)
        accessible_ids = set(
            str(pk)
            for pk in Project.objects.filter(
                workspace=workspace,
                project_projectmember__member=request.user,
                project_projectmember__is_active=True,
                archived_at__isnull=True,
            ).values_list("id", flat=True)
        )
        if set(project_ids) - accessible_ids:
            return Response({"error": "One or more projects are not accessible."}, status=status.HTTP_403_FORBIDDEN)

        if provider in ["csv", "xlsx", "json"]:
            if not project_ids:
                project_ids = Project.objects.filter(
                    workspace__slug=slug,
                    project_projectmember__member=request.user,
                    project_projectmember__is_active=True,
                    archived_at__isnull=True,
                ).values_list("id", flat=True)
                project_ids = [str(project_id) for project_id in project_ids]

            exporter = ExporterHistory.objects.create(
                workspace=workspace,
                project=project_ids,
                initiated_by=request.user,
                provider=provider,
                type="issue_exports",
                rich_filters=rich_filters,
            )

            issue_export_task.delay(
                provider=exporter.provider,
                workspace_id=workspace.id,
                project_ids=project_ids,
                token_id=exporter.token,
                multiple=multiple,
                slug=slug,
            )
            return Response(
                {"message": "Once the export is ready you will be able to download it"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"error": f"Provider '{provider}' not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug, pk=None):
        if pk is not None:
            export = get_object_or_404(ExporterHistory, pk=pk, workspace__slug=slug, type="issue_exports")
            if export.status != "completed" or not export.key:
                return Response({"error": "Export is not ready for download."}, status=status.HTTP_409_CONFLICT)
            if not export.key.startswith(f"{export.workspace_id}/"):
                return Response(status=status.HTTP_404_NOT_FOUND)
            try:
                storage = S3Storage()
                file = storage.s3_client.get_object(Bucket=storage.aws_storage_bucket_name, Key=export.key)
                response = FileResponse(
                    file["Body"],
                    as_attachment=True,
                    filename=PurePosixPath(export.key).name,
                    content_type="application/zip",
                )
                response["Content-Length"] = file["ContentLength"]
                return response
            except ClientError as error:
                if error.response.get("Error", {}).get("Code") in {"404", "NoSuchKey"}:
                    return Response({"error": "Export file is no longer available."}, status=status.HTTP_404_NOT_FOUND)
                raise

        exporter_history = ExporterHistory.objects.filter(workspace__slug=slug, type="issue_exports").select_related(
            "workspace", "initiated_by"
        )

        if request.GET.get("per_page", False) and request.GET.get("cursor", False):
            return self.paginate(
                order_by=request.GET.get("order_by", "-created_at"),
                request=request,
                queryset=exporter_history,
                on_results=lambda exporter_history: ExporterHistorySerializer(
                    exporter_history, many=True, context={"request": request}
                ).data,
            )
        else:
            return Response(
                {"error": "per_page and cursor are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ExportIssuesDownloadEndpoint(ExportIssuesEndpoint):
    http_method_names = ["get", "head", "options"]
