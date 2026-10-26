# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from time import monotonic
from urllib.parse import quote

from plane.utils.feishu_client import FeishuError

MAX_MEMBERS = 500
MAX_REQUESTS = 40
MAX_SECONDS = 25


class FeishuDirectory:
    """Fail closed: every page must succeed within a bounded request budget."""

    def __init__(self, client):
        self.client = client
        self.deadline = monotonic() + MAX_SECONDS
        self.requests = 0
        self.token = client.tenant_token()

    def get(self, path, **params):
        remaining = self.deadline - monotonic()
        if self.requests >= MAX_REQUESTS or remaining <= 0:
            raise FeishuError("directory_limit")
        self.requests += 1
        data = self.client.request(
            "GET",
            path,
            params=params,
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=(min(3, remaining), min(5, remaining)),
        ).get("data")
        if not isinstance(data, dict):
            raise FeishuError("invalid_provider_response")
        return data

    def pages(self, path, fields=("items",), **params):
        seen = set()
        while True:
            data = self.get(path, page_size=50, **params)
            for field in fields:
                if not isinstance(data.get(field, []), list):
                    raise FeishuError("invalid_provider_response")
            yield data
            more = data.get("has_more")
            if not isinstance(more, bool):
                raise FeishuError("invalid_provider_response")
            if not more:
                break
            token = data.get("page_token")
            if not isinstance(token, str) or not token or token in seen:
                raise FeishuError("invalid_provider_response")
            seen.add(token)
            params["page_token"] = token

    def collect(self):
        tenant = self.get("/tenant/v2/tenant/query").get("tenant", {})
        tenant_key = tenant.get("tenant_key") if isinstance(tenant, dict) else None
        if not isinstance(tenant_key, str) or not 1 <= len(tenant_key) <= 128:
            raise FeishuError("missing_identity")
        users, departments = set(), set()
        for page in self.pages(
            "/contact/v3/scopes",
            fields=("user_ids", "department_ids", "group_ids"),
            user_id_type="open_id",
            department_id_type="open_department_id",
        ):
            for group in self.ids(page.get("group_ids", [])):
                for member_type, destination in (("user", users), ("department", departments)):
                    for group_page in self.pages(
                        f"/contact/v3/group/{quote(group, safe='')}/member/simplelist",
                        fields=("memberlist",),
                        member_type=member_type,
                        member_id_type="open_id",
                    ):
                        for member in group_page.get("memberlist", []):
                            if not isinstance(member, dict) or member.get("member_type") != member_type:
                                raise FeishuError("invalid_provider_response")
                            destination.update(self.ids([member.get("member_id")]))
                        self.check_size(destination)
            users.update(self.ids(page.get("user_ids", [])))
            departments.update(self.ids(page.get("department_ids", [])))
            self.check_size(users)
            self.check_size(departments)
        roots = sorted(departments)
        for department in roots:
            for page in self.pages(
                f"/contact/v3/departments/{quote(department, safe='')}/children",
                fetch_child="true",
                department_id_type="open_department_id",
            ):
                for item in page.get("items", []):
                    if not isinstance(item, dict):
                        raise FeishuError("invalid_provider_response")
                    departments.update(self.ids([item.get("open_department_id")]))
                self.check_size(departments)
        members = {}
        for department in sorted(departments):
            for page in self.pages(
                "/contact/v3/users/find_by_department",
                department_id=department,
                department_id_type="open_department_id",
                user_id_type="open_id",
            ):
                for member in page.get("items", []):
                    self.add(members, member)
        for user in sorted(users - members.keys()):
            data = self.get(f"/contact/v3/users/{quote(user, safe='')}", user_id_type="open_id")
            member = data.get("user")
            if not isinstance(member, dict) or member.get("open_id") != user:
                raise FeishuError("missing_identity")
            self.add(members, member)
        return tenant_key, list(members.values())

    @staticmethod
    def ids(values):
        if any(not isinstance(value, str) or not 1 <= len(value) <= 128 for value in values):
            raise FeishuError("invalid_provider_response")
        return values

    @staticmethod
    def check_size(values):
        if len(values) > MAX_MEMBERS:
            raise FeishuError("directory_limit")

    def add(self, members, member):
        if not isinstance(member, dict):
            raise FeishuError("invalid_provider_response")
        self.ids([member.get("open_id")])
        status = member.get("status", {})
        if not isinstance(status, dict):
            raise FeishuError("invalid_provider_response")
        if (
            any(status.get(key) is True for key in ("is_frozen", "is_resigned", "is_exited", "is_unjoin"))
            or status.get("is_activated") is False
        ):
            return
        # Missing email permission leaves entries available for explicit manual selection.
        email = member.get("email", "") or ""
        name = member.get("name", "") or ""
        if not isinstance(email, str) or not isinstance(name, str) or len(email) > 255:
            raise FeishuError("invalid_provider_response")
        union_id = member.get("union_id", "") or ""
        if not isinstance(union_id, str) or len(union_id) > 128:
            raise FeishuError("invalid_provider_response")
        value = {"open_id": member["open_id"], "union_id": union_id, "email": email, "name": name[:255]}
        if member["open_id"] in members and members[member["open_id"]] != value:
            raise FeishuError("directory_changed")
        members[member["open_id"]] = value
        self.check_size(members)
