import pytest
from django.utils import timezone

from plane.db.models import User, Workspace, WorkspaceMember, WorkspaceMemberInvite

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def url(workspace):
    return f"/api/workspaces/{workspace.slug}/invite-candidates/"


def candidate(email="candidate@example.com", **kwargs):
    return User.objects.create(email=email, username=email, **kwargs)


def test_candidates_return_invitation_status_and_minimal_fields(session_client, workspace, create_user):
    eligible = candidate(
        display_name="Candidate", first_name="First", last_name="Last", avatar="https://example.com/a.png"
    )
    inactive_member = candidate("former@example.com")
    WorkspaceMember.objects.create(workspace=workspace, member=inactive_member, role=15, is_active=False)
    active_member = candidate("member@example.com")
    WorkspaceMember.objects.create(workspace=workspace, member=active_member, role=15)
    WorkspaceMemberInvite.objects.create(workspace=workspace, email=active_member.email, token="joined-pending")
    for email, flags in (("inactive@example.com", {"is_active": False}), ("bot@example.com", {"is_bot": True})):
        excluded = candidate(email, **flags)
        WorkspaceMember.objects.create(workspace=workspace, member=excluded, role=15)
        WorkspaceMemberInvite.objects.create(workspace=workspace, email=excluded.email, token=email)
    for index, email in enumerate(("", None)):
        no_email = candidate(f"no-email-{index}@example.com")
        User.objects.filter(pk=no_email.pk).update(email=email)
    pending = candidate("pending@example.com")
    WorkspaceMemberInvite.objects.create(workspace=workspace, email=pending.email.upper(), token="pending")
    responded = candidate("declined@example.com")
    WorkspaceMemberInvite.objects.create(
        workspace=workspace, email=responded.email, token="declined", responded_at=timezone.now(), accepted=False
    )
    accepted = candidate("accepted@example.com")
    WorkspaceMemberInvite.objects.create(
        workspace=workspace, email=accepted.email, token="accepted", responded_at=timezone.now(), accepted=True
    )
    other = Workspace.objects.create(name="Other", slug="other", owner=create_user)
    WorkspaceMember.objects.create(workspace=other, member=eligible, role=15)
    WorkspaceMemberInvite.objects.create(workspace=other, email=eligible.email, token="other")

    response = session_client.get(url(workspace))
    assert response.status_code == 200
    assert isinstance(response.data, list)
    assert {str(row["id"]): row["invitation_status"] for row in response.data} == {
        str(create_user.id): "joined",
        str(active_member.id): "joined",
        str(pending.id): "invited",
        str(eligible.id): "available",
        str(inactive_member.id): "available",
        str(responded.id): "available",
        str(accepted.id): "available",
    }
    assert all(
        set(row) == {"id", "email", "display_name", "first_name", "last_name", "avatar_url", "invitation_status"}
        for row in response.data
    )
    row = next(row for row in response.data if str(row["id"]) == str(eligible.id))
    assert row["avatar_url"] == eligible.avatar
    assert row["display_name"] == "Candidate"
    assert row["first_name"] == "First"
    assert row["last_name"] == "Last"


@pytest.mark.parametrize("field", ["email", "display_name", "first_name", "last_name"])
def test_search_is_case_insensitive_and_trimmed(session_client, workspace, field):
    values = {"email": "person@example.com", field: "Needle@example.com" if field == "email" else "Needle"}
    match = candidate(**values)
    candidate("other@example.com")
    response = session_client.get(url(workspace), {"search": "  nEEdLe  "})
    assert response.status_code == 200
    assert [str(row["id"]) for row in response.data] == [str(match.id)]
    assert session_client.get(url(workspace), {"search": "missing"}).data == []
    assert len(session_client.get(url(workspace), {"search": "  "}).data) == 3


@pytest.mark.parametrize("role,active", [(15, True), (10, True), (5, True), (20, False)])
def test_only_active_workspace_admin_can_list(session_client, workspace, create_user, role, active):
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=role, is_active=active)
    assert session_client.get(url(workspace)).status_code == 403


def test_other_workspace_admin_and_nonmember_cannot_list(session_client, workspace, create_user):
    other = Workspace.objects.create(name="Other", slug="other", owner=create_user)
    assert session_client.get(url(other)).status_code == 403
    assert session_client.get("/api/workspaces/missing/invite-candidates/").status_code == 403


def test_anonymous_cannot_list(api_client, workspace):
    assert api_client.get(url(workspace)).status_code in (401, 403)


def test_empty_search_candidates(session_client, workspace):
    assert session_client.get(url(workspace), {"search": "missing"}).data == []


def test_user_invitations_only_list_unanswered_case_insensitive_email(session_client, workspace, create_user):
    pending = WorkspaceMemberInvite.objects.create(
        workspace=workspace, email=create_user.email.upper(), token="pending"
    )
    for accepted in (False, True):
        other = Workspace.objects.create(name="Responded", slug=f"responded-{accepted}", owner=create_user)
        WorkspaceMemberInvite.objects.create(
            workspace=other,
            email=create_user.email,
            token=f"responded-{accepted}",
            responded_at=timezone.now(),
            accepted=accepted,
        )
    WorkspaceMemberInvite.objects.create(workspace=workspace, email="other@example.com", token="other")

    response = session_client.get("/api/users/me/workspaces/invitations/")

    assert response.status_code == 200
    assert [str(row["id"]) for row in response.data] == [str(pending.id)]


@pytest.mark.parametrize("existing_member", [False, True])
def test_bulk_accept_only_unanswered_invitations(session_client, create_user, existing_member):
    invitations = []
    workspaces = []
    for index, responded in enumerate((None, False, True, "other-user")):
        workspace = Workspace.objects.create(name=f"Workspace {index}", slug=f"bulk-{index}", owner=create_user)
        workspaces.append(workspace)
        invitations.append(
            WorkspaceMemberInvite.objects.create(
                workspace=workspace,
                email="other@example.com" if responded == "other-user" else create_user.email.upper(),
                token=f"bulk-{index}",
                role=15,
                responded_at=timezone.now() if responded in (False, True) else None,
                accepted=responded is True,
            )
        )
        if existing_member:
            WorkspaceMember.objects.create(workspace=workspace, member=create_user, role=5, is_active=False)

    response = session_client.post(
        "/api/users/me/workspaces/invitations/",
        {"invitations": [str(invitation.id) for invitation in invitations]},
        format="json",
    )

    assert response.status_code == 204
    pending_member = WorkspaceMember.objects.get(workspace=workspaces[0], member=create_user)
    assert pending_member.is_active is True
    assert pending_member.role == 15
    assert not WorkspaceMemberInvite.objects.filter(pk=invitations[0].pk).exists()
    assert WorkspaceMemberInvite.objects.filter(pk__in=[item.pk for item in invitations[1:]]).count() == 3
    untouched_members = WorkspaceMember.objects.filter(workspace__in=workspaces[1:], member=create_user)
    if existing_member:
        assert untouched_members.count() == 3
        assert all(not member.is_active and member.role == 5 for member in untouched_members)
    else:
        assert not untouched_members.exists()
