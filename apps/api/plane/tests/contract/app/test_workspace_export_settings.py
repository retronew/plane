from unittest.mock import patch
import pytest
from plane.db.models import Project, ProjectMember, Issue, ExporterHistory, Workspace
from plane.bgtasks.export_task import issue_export_task

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def test_export_rejects_inaccessible_projects_and_invalid_filters(session_client, workspace, create_user):
    other = Workspace.objects.create(name="Other", slug="export-other", owner=create_user)
    project = Project.objects.create(workspace=other, name="Private", identifier="PRV")
    endpoint = f"/api/workspaces/{workspace.slug}/export-issues/"
    with patch("plane.app.views.exporter.base.issue_export_task.delay") as task:
        response = session_client.post(endpoint, {"provider": "csv", "project": [str(project.id)]}, format="json")
        assert response.status_code == 403
        response = session_client.post(
            endpoint, {"provider": "csv", "rich_filters": {"secret__exact": "x"}}, format="json"
        )
        assert response.status_code == 400
        task.assert_not_called()
    assert not ExporterHistory.objects.exists()


def test_export_persists_and_applies_filter_to_real_queryset(session_client, workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Export", identifier="EXP")
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    wanted = Issue.objects.create(project=project, name="High", priority="high")
    Issue.objects.create(project=project, name="Low", priority="low")
    filters = {"priority__in": ["high"]}
    with patch("plane.app.views.exporter.base.issue_export_task.delay") as task:
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/export-issues/",
            {"provider": "csv", "project": [str(project.id)], "rich_filters": filters},
            format="json",
        )
        assert response.status_code == 200
        task.assert_called_once()
    history = ExporterHistory.objects.get()
    assert history.rich_filters == filters
    captured = []

    def export(name, queryset):
        captured.extend(queryset.values_list("id", flat=True))
        return "export.csv", "name\nHigh"

    with (
        patch("plane.bgtasks.export_task.DataExporter") as exporter,
        patch("plane.bgtasks.export_task.upload_to_s3") as upload,
    ):
        exporter.return_value.export.side_effect = export
        issue_export_task("csv", workspace.id, [str(project.id)], history.token, False, workspace.slug)
        upload.assert_called_once()
    assert captured == [wanted.id]
