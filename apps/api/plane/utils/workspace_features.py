from rest_framework.exceptions import PermissionDenied
from plane.db.models import WorkspaceMember


def check_project_creation(workspace, user):
    if workspace.allow_member_project_creation:
        return
    if not WorkspaceMember.objects.filter(workspace=workspace, member=user, role=20, is_active=True).exists():
        raise PermissionDenied("Only workspace administrators can create projects.")
