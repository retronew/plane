from unittest.mock import Mock

import pytest

from plane.utils.feishu_client import FeishuError
from plane.utils.feishu_directory import FeishuDirectory

pytestmark = pytest.mark.unit


def directory(responses):
    client = Mock()
    client.tenant_token.return_value = "token"
    client.request.side_effect = [{"data": response} for response in responses]
    return FeishuDirectory(client)


def test_collect_all_scopes_department_and_group_pages():
    service = directory(
        [
            {"tenant": {"tenant_key": "tenant"}},
            {
                "user_ids": ["direct"],
                "department_ids": [],
                "group_ids": ["group"],
                "has_more": True,
                "page_token": "next",
            },
            {"memberlist": [{"member_id": "group-user", "member_type": "user"}], "has_more": False},
            {"memberlist": [{"member_id": "department", "member_type": "department"}], "has_more": False},
            {"user_ids": [], "department_ids": [], "group_ids": [], "has_more": False},
            {"items": [{"open_department_id": "child"}], "has_more": False},
            {"items": [{"open_id": "child-user", "email": "child@example.com"}], "has_more": False},
            {"items": [{"open_id": "department-user"}], "has_more": False},
            {"user": {"open_id": "direct"}},
            {"user": {"open_id": "group-user"}},
        ]
    )
    tenant, members = service.collect()
    assert tenant == "tenant"
    assert {member["open_id"] for member in members} == {"child-user", "department-user", "direct", "group-user"}
    assert service.client.request.call_count == 10


@pytest.mark.parametrize("page", [{"has_more": True}, {"has_more": "false"}, {"has_more": False, "user_ids": "bad"}])
def test_invalid_pagination_fails_closed(page):
    service = directory([{"tenant": {"tenant_key": "tenant"}}, page])
    with pytest.raises(FeishuError, match="invalid_provider_response"):
        service.collect()


def test_repeating_page_token_fails_closed():
    service = directory([{"has_more": True, "page_token": "same"}] * 2)
    with pytest.raises(FeishuError, match="invalid_provider_response"):
        list(service.pages("/test"))


def test_group_permission_failure_is_not_ignored():
    service = directory([{"tenant": {"tenant_key": "tenant"}}, {"group_ids": ["group"], "has_more": False}])
    service.client.request.side_effect = [
        {"data": {"tenant": {"tenant_key": "tenant"}}},
        {"data": {"group_ids": ["group"], "has_more": False}},
        FeishuError("provider_error_99991672"),
    ]
    with pytest.raises(FeishuError, match="provider_error"):
        service.collect()


@pytest.mark.parametrize(
    "status",
    [{"is_frozen": True}, {"is_resigned": True}, {"is_exited": True}, {"is_unjoin": True}, {"is_activated": False}],
)
def test_inactive_members_are_excluded(status):
    service = directory([])
    members = {}
    service.add(members, {"open_id": "user", "status": status})
    assert members == {}


def test_budgets_and_duplicate_identity_changes():
    service = directory([])
    service.requests = 40
    with pytest.raises(FeishuError, match="directory_limit"):
        service.get("/test")
    members = {}
    service.add(members, {"open_id": "user", "email": "one@example.com"})
    with pytest.raises(FeishuError, match="directory_changed"):
        service.add(members, {"open_id": "user", "email": "two@example.com"})
    with pytest.raises(FeishuError, match="directory_limit"):
        service.check_size(range(501))
