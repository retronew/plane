from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from plane.db.models import Account, User
from plane.db.models.feishu import FeishuAdminBindingAudit, FeishuBinding, FeishuOAuthState
from plane.services.feishu_directory import bind_preview, create_preview, matches, preview_data, unbind_preview
from plane.utils.feishu_client import FeishuConfig, FeishuError

pytestmark = [pytest.mark.contract, pytest.mark.django_db]
CONFIG = FeishuConfig(True, "app", "secret")


@pytest.fixture
def member(create_user):
    create_user.is_email_verified = True
    create_user.save()
    return {"open_id": "open", "email": create_user.email, "name": "Member"}


@pytest.fixture
def directory(member):
    with (
        patch("plane.services.feishu_directory.get_feishu_config", return_value=CONFIG),
        patch("plane.services.feishu_directory.FeishuClient"),
        patch("plane.services.feishu_directory.FeishuDirectory.collect", return_value=("tenant", [member])) as collect,
    ):
        yield collect


def row_for(preview, user):
    return next(row for row in preview.rows if row["user_id"] == str(user.pk))


def submit(user, preview, row, member_id=None, enable=False):
    selection = {"row_id": row["id"]}
    if member_id:
        selection["member_id"] = member_id
    return bind_preview(user, preview.pk, [selection], enable)


def test_system_users_remain_visible_without_feishu_members(create_user, directory):
    for i in range(5):
        User.objects.create(email=f"user{i}@example.com", username=f"user{i}")
    directory.return_value = ("tenant", [])
    preview = create_preview(create_user)
    assert len(preview.rows) == 6
    assert all(row["member_id"] is None and row["result"] is None for row in preview.rows)
    assert preview_data(preview)["members"] == []


def test_modes_count_plane_users_and_keep_existing_binding(create_user, directory):
    User.objects.create(email="unbound@example.com", username="unbound")
    binding = FeishuBinding.objects.create(
        user=create_user, app_id="app", tenant_key="tenant", open_id="open", display_name="Member"
    )
    assert len(create_preview(create_user).rows) == 1
    preview = create_preview(create_user, "all")
    assert len(preview.rows) == 2
    row = row_for(preview, create_user)
    assert row["binding_id"] == str(binding.pk) and row["result"] == "already_bound"
    assert preview_data(preview)["members"] == []


def test_automatic_binding_audit_idempotency_and_oauth_invalidation(create_user, directory):
    preview = create_preview(create_user)
    row = row_for(preview, create_user)
    FeishuOAuthState.objects.create(
        user=create_user,
        app_id="app",
        state_hash="state",
        session_hash="hash",
        verifier="",
        expires_at=timezone.now() + timedelta(minutes=5),
    )
    with patch("plane.services.feishu_directory.update_preferences") as preferences:
        result = submit(create_user, preview, row, enable=True)
        assert row_for(result, create_user)["result"] == "bound"
        submit(create_user, preview, row, enable=True)
        assert preferences.call_count == 1
    assert FeishuBinding.objects.count() == 1
    assert FeishuAdminBindingAudit.objects.get().match_basis == "email"
    assert not FeishuOAuthState.objects.filter(user=create_user).exists()


def test_manual_unverified_user_and_available_member(create_user, directory):
    other = User.objects.create(email="manual@example.com", username="manual")
    preview = create_preview(create_user)
    row = row_for(preview, other)
    result = submit(create_user, preview, row, preview.members[0]["id"])
    assert row_for(result, other)["result"] == "bound"
    assert FeishuAdminBindingAudit.objects.get().match_basis == "manual"
    other.refresh_from_db()
    assert not other.is_email_verified


@pytest.mark.parametrize("field,value", [("is_active", False), ("is_bot", True), ("masked_at", timezone.now())])
def test_changed_user_eligibility_blocks_binding(create_user, directory, field, value):
    preview = create_preview(create_user)
    setattr(create_user, field, value)
    create_user.save()
    result = submit(create_user, preview, row_for(preview, create_user))
    assert row_for(result, create_user)["result"] == "user_ineligible"
    assert not FeishuBinding.objects.exists()


def test_member_occupied_after_preview_not_overwritten(create_user, directory):
    preview = create_preview(create_user)
    other = User.objects.create(email="owner@example.com", username="owner")
    binding = FeishuBinding.objects.create(user=other, app_id="app", tenant_key="tenant", open_id="open")
    result = submit(create_user, preview, row_for(preview, create_user))
    assert row_for(result, create_user)["result"] == "conflict"
    assert FeishuBinding.objects.get().pk == binding.pk


def test_duplicate_member_selection_rejected(create_user, directory):
    User.objects.create(email="other@example.com", username="other")
    preview = create_preview(create_user)
    with pytest.raises(FeishuError, match="invalid_selection"):
        bind_preview(
            create_user,
            preview.pk,
            [{"row_id": row["id"], "member_id": preview.members[0]["id"]} for row in preview.rows],
            False,
        )
    assert not FeishuBinding.objects.exists()


@pytest.mark.parametrize("change", ["email", "name", "union_id", "missing", "duplicate"])
def test_stale_directory_revalidated(create_user, directory, member, change):
    preview = create_preview(create_user)
    if change == "missing":
        members = []
    elif change == "duplicate":
        members = [member, {**member, "open_id": "duplicate"}]
    else:
        members = [{**member, change: "changed"}]
    directory.return_value = ("tenant", members)
    result = submit(create_user, preview, row_for(preview, create_user))
    assert row_for(result, create_user)["result"] == "match_changed"
    assert not FeishuBinding.objects.exists()


@pytest.mark.parametrize("failure", ["expired", "owner", "partial", "config"])
def test_preview_boundaries(create_user, directory, failure):
    preview = create_preview(create_user)
    if failure == "expired":
        preview.expires_at = timezone.now() - timedelta(seconds=1)
    if failure == "owner":
        preview.administrator = None
    if failure == "partial":
        preview.status = "partial"
    if failure == "config":
        preview.config_digest = "changed"
    preview.save()
    with pytest.raises(FeishuError):
        submit(create_user, preview, row_for(preview, create_user))
    assert not FeishuBinding.objects.exists()


def test_directory_failure_is_partial_and_blocks_binding(create_user, directory):
    directory.side_effect = FeishuError("directory_limit")
    preview = create_preview(create_user)
    assert preview.status == "partial"
    with pytest.raises(FeishuError, match="preview_incomplete"):
        bind_preview(create_user, preview.pk, [], False)


def test_unbind_preserves_oidc_and_allows_rebind(create_user, directory):
    Account.objects.create(user=create_user, provider="oidc", provider_account_id="sub", access_token="")
    FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="open")
    preview = create_preview(create_user, "all")
    row = row_for(preview, create_user)
    unbind_preview(create_user, preview.pk, row["id"])
    unbind_preview(create_user, preview.pk, row["id"])
    assert not FeishuBinding.objects.exists()
    assert Account.objects.filter(user=create_user, provider="oidc").exists()
    assert FeishuAdminBindingAudit.objects.get().source == "admin_unbind"
    fresh = create_preview(create_user)
    submit(create_user, fresh, row_for(fresh, create_user))
    assert FeishuBinding.objects.filter(user=create_user).exists()


def test_stale_unbind_cannot_delete_replacement_binding(create_user, directory):
    FeishuBinding.objects.create(user=create_user, app_id="app", tenant_key="tenant", open_id="open")
    preview = create_preview(create_user, "all")
    FeishuBinding.objects.all().delete()
    replacement = FeishuBinding.objects.create(
        user=create_user, app_id="app", tenant_key="tenant", open_id="replacement"
    )
    with pytest.raises(FeishuError, match="binding_changed"):
        unbind_preview(create_user, preview.pk, row_for(preview, create_user)["id"])
    assert FeishuBinding.objects.get().pk == replacement.pk


@pytest.mark.parametrize("mode", ["invalid", "", None])
def test_invalid_mode(create_user, mode):
    with pytest.raises(FeishuError, match="invalid_mode"):
        create_preview(create_user, mode)


def test_all_admin_endpoints_enforce_permission(session_client):
    for path in ["", "bind/", "unbind/"]:
        response = session_client.post(f"/api/instances/feishu/directory/{path}", {}, format="json")
        assert response.status_code in (401, 403)


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://evil.example/userinfo",
        "https://open.feishu.cn.evil.example/open-apis/authen/v1/user_info",
        "http://open.feishu.cn/open-apis/authen/v1/user_info",
    ],
)
def test_untrusted_oidc_endpoint_never_asserts_identity(endpoint):
    from plane.authentication.provider.oauth.oidc import trusted_feishu_identity

    assert trusted_feishu_identity(endpoint, "app", {"open_id": "open", "tenant_key": "tenant"}) is None


def test_trusted_oidc_identity_requires_explicit_claims():
    from plane.authentication.provider.oauth.oidc import trusted_feishu_identity

    endpoint = "https://open.feishu.cn/open-apis/authen/v1/user_info"
    assert trusted_feishu_identity(endpoint, "app", {"sub": "open"}) is None
    assert trusted_feishu_identity(endpoint, "app", {"open_id": "open", "tenant_key": "tenant"})["client_id"] == "app"


def test_oidc_priority_conflict_and_app_scope(create_user, member):
    from plane.db.models import Account

    other = User.objects.create(email="oidc@example.com", username="oidc", is_email_verified=True)
    identity = {
        "endpoint": "https://open.feishu.cn/open-apis/authen/v1/user_info",
        "client_id": "app",
        "tenant_key": "tenant",
        "open_id": "open",
    }
    account = Account.objects.create(
        user=other, provider="oidc", provider_account_id="sub", access_token="", metadata={"feishu_identity": identity}
    )
    result = matches([member], "app", "tenant")[0]
    assert result["user_id"] == str(other.pk) and result["match_basis"] == "oidc"
    assert matches([member], "another-app", "tenant")[0]["match_basis"] == "email"
    assert matches([member], "app", "another-tenant")[0]["match_basis"] == "identity_conflict"
    identity["union_id"] = "union"
    account.metadata = {"feishu_identity": identity}
    account.save()
    assert matches([{**member, "union_id": "union"}], "another-app", "tenant")[0]["match_basis"] == "oidc"
    other.is_active = False
    other.save()
    assert matches([member], "app", "tenant")[0]["match_basis"] == "identity_conflict"


def test_oidc_complete_userinfo_login_and_link_paths(create_user):
    from unittest.mock import Mock
    from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
    from plane.db.models import Account

    provider = object.__new__(OIDCOAuthProvider)
    provider.provider = "oidc"
    provider.client_id = "app"
    provider.userinfo_url = "https://open.feishu.cn/open-apis/authen/v1/user_info"
    provider.trust_email = True
    provider.token_data = {"access_token": "token"}
    response = Mock()
    response.json.return_value = {
        "code": 0,
        "data": {"open_id": "open", "tenant_key": "tenant", "email": create_user.email, "name": "User"},
    }
    with patch("plane.authentication.adapter.oauth.requests.get", return_value=response):
        provider.set_user_data()
        assert provider.user_data["user"]["provider_id"] == "open"
        provider.create_update_account(create_user)
        account = Account.objects.get(user=create_user, provider="oidc")
        assert account.metadata["feishu_identity"]["tenant_key"] == "tenant"
        with patch.object(provider, "set_token_data"):
            assert provider.fetch_identity() == ("open", create_user.email.lower())
        assert provider.token_data["metadata"]["feishu_identity"]["open_id"] == "open"


@pytest.mark.parametrize("field", ["display_name", "username", "full_name"])
def test_unique_exact_name_suggestion_and_audit(create_user, directory, field):
    User.objects.filter(pk=create_user.pk).update(
        display_name="Display", username="Username", first_name="First", last_name="Last", is_email_verified=False
    )
    create_user.refresh_from_db()
    name = getattr(create_user, field)
    directory.return_value = ("tenant", [{"open_id": "open", "email": "", "name": f" {name} "}])
    preview = create_preview(create_user)
    row = row_for(preview, create_user)
    assert row["match_basis"] == "name"
    result = submit(create_user, preview, row)
    assert row_for(result, create_user)["result"] == "bound"
    assert FeishuAdminBindingAudit.objects.get().match_basis == "name"
    create_user.refresh_from_db()
    assert not create_user.is_email_verified


@pytest.mark.parametrize("ambiguity", ["plane", "feishu", "alias", "case", "blank"])
def test_name_suggestions_require_both_sides_unique(create_user, ambiguity):
    User.objects.filter(pk=create_user.pk).update(display_name="Exact", username="Alias")
    members = [{"open_id": "open", "email": "", "name": "Exact"}]
    if ambiguity == "plane":
        User.objects.create(email="duplicate@example.com", username="other", display_name="Exact")
    elif ambiguity == "feishu":
        members.append({**members[0], "open_id": "second"})
    elif ambiguity == "alias":
        members.append({**members[0], "open_id": "second", "name": "Alias"})
    else:
        members[0]["name"] = "exact" if ambiguity == "case" else "   "
    assert all(row["match_basis"] == "unmatched" for row in matches(members))


@pytest.mark.parametrize("change", ["plane_name", "plane_duplicate", "feishu_duplicate", "feishu_name"])
def test_name_suggestion_revalidated_at_submission(create_user, directory, change):
    User.objects.filter(pk=create_user.pk).update(display_name="Exact", username="Alias")
    member = {"open_id": "open", "email": "", "name": "Exact"}
    directory.return_value = ("tenant", [member])
    preview = create_preview(create_user)
    row = row_for(preview, create_user)
    assert row["match_basis"] == "name"
    if change == "plane_name":
        User.objects.filter(pk=create_user.pk).update(display_name="Changed")
    elif change == "plane_duplicate":
        User.objects.create(email="duplicate@example.com", username="other", display_name="Exact")
    elif change == "feishu_duplicate":
        directory.return_value = ("tenant", [member, {**member, "open_id": "second"}])
    else:
        directory.return_value = ("tenant", [{**member, "name": "Alias"}])
    result = submit(create_user, preview, row)
    assert row_for(result, create_user)["result"] == "match_changed"
    assert not FeishuBinding.objects.exists()


def test_email_and_oidc_take_priority_over_name(create_user, member):
    other = User.objects.create(email="name@example.com", username="named", display_name=member["name"])
    assert matches([member], "app", "tenant")[0]["match_basis"] == "email"
    Account.objects.create(
        user=create_user,
        provider="oidc",
        provider_account_id="name-priority",
        access_token="",
        metadata={
            "feishu_identity": {
                "endpoint": "https://open.feishu.cn/open-apis/authen/v1/user_info",
                "client_id": "app",
                "tenant_key": "tenant",
                "open_id": "open",
            }
        },
    )
    without_email = {**member, "email": ""}
    assert matches([without_email], "app", "tenant")[0]["match_basis"] == "oidc"
    assert matches([without_email], "app", "wrong-tenant")[0]["match_basis"] == "identity_conflict"
    assert matches([without_email])[0]["user_id"] == str(other.pk)
