# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Tool framework: one MCP tool per Plane resource, with an ``action`` argument
selecting the operation (the same shape as the official plane-mcp-server).
"""

# Python imports
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

# Django imports
from django.db.models import Q

# Module imports
from plane.db.models import Cycle, Issue, Label, Module, Project, ProjectMember, State, WorkspaceMember
from plane.mcp.formatting import compact, page_of
from plane.mcp.gateway import ApiGateway, ApiResult

MAX_PER_PAGE = 100
DEFAULT_PER_PAGE = 50
WORK_ITEM_KEY = re.compile(r"^\s*([A-Za-z0-9]{1,12})-(\d+)\s*$")


class ToolError(Exception):
    """An error the model can act on; returned as a tool result with ``isError``."""


@dataclass
class Context:
    request: Any
    user: Any
    slug: str | None
    gateway: ApiGateway
    workspace_scope: str | None = None

    # -- API ------------------------------------------------------------------

    def api(self, method, path, query=None, body=None) -> Any:
        result = self.gateway.call(method, f"workspaces/{self.slug}/{path.lstrip('/')}", query, body)
        return raise_for_status(result)

    def api_root(self, method, path, query=None, body=None) -> Any:
        return raise_for_status(self.gateway.call(method, path, query, body))

    def list_page(self, path, args, query=None):
        query = dict(query or {})
        query["per_page"] = min(int(args.get("per_page") or DEFAULT_PER_PAGE), MAX_PER_PAGE)
        if args.get("cursor"):
            query["cursor"] = args["cursor"]
        return page_of(self.api("GET", path, query))

    # -- Identifier resolution ----------------------------------------------------

    def projects(self):
        return Project.objects.filter(
            workspace__slug=self.slug,
            archived_at__isnull=True,
            project_projectmember__member=self.user,
            project_projectmember__is_active=True,
        ).distinct()

    def project_id(self, value) -> str:
        if not value:
            raise ToolError("缺少 project：请传项目标识（如 WEB）或项目 ID。可用 project(action='list') 查看。")
        value = str(value).strip()
        queryset = self.projects()
        project = queryset.filter(pk=value).first() if is_uuid(value) else None
        project = project or queryset.filter(Q(identifier__iexact=value) | Q(name__iexact=value)).first()
        if project is None:
            raise ToolError(f"找不到项目 {value}，或你不是该项目成员。可用 project(action='list') 查看。")
        return str(project.id)

    def work_item(self, value, project=None) -> tuple[str, str]:
        """Resolve ``PROJ-12`` or a UUID to (project_id, work_item_id)."""
        if not value:
            raise ToolError("缺少 work_item：请传工作项编号（如 WEB-12）或 ID。")
        value = str(value).strip()
        queryset = Issue.issue_objects.filter(workspace__slug=self.slug, project__in=self.projects())
        match = WORK_ITEM_KEY.match(value)
        if match:
            issue = queryset.filter(project__identifier__iexact=match.group(1), sequence_id=int(match.group(2))).first()
        elif is_uuid(value):
            issue = queryset.filter(pk=value).first()
        else:
            issue = None
        if issue is None:
            raise ToolError(f"找不到工作项 {value}。请使用 WEB-12 这样的编号，或先用 workitem(action='list') 查找。")
        if project and str(issue.project_id) != self.project_id(project):
            raise ToolError(f"工作项 {value} 不属于项目 {project}。")
        return str(issue.project_id), str(issue.id)

    def state_id(self, project_id, value) -> str:
        states = State.objects.filter(project_id=project_id)
        state = states.filter(pk=value).first() if is_uuid(value) else None
        state = state or states.filter(name__iexact=str(value).strip()).first()
        if state is None:
            names = ", ".join(states.order_by("sequence").values_list("name", flat=True))
            raise ToolError(f"找不到状态 {value}。该项目的状态有：{names}")
        return str(state.id)

    def label_ids(self, project_id, values) -> list[str]:
        labels = Label.objects.filter(project_id=project_id)
        ids, missing = [], []
        for value in as_list(values):
            label = labels.filter(pk=value).first() if is_uuid(value) else None
            label = label or labels.filter(name__iexact=str(value).strip()).first()
            (ids.append(str(label.id)) if label else missing.append(str(value)))
        if missing:
            names = ", ".join(labels.order_by("name").values_list("name", flat=True)) or "（无）"
            raise ToolError(f"找不到标签 {', '.join(missing)}。该项目的标签有：{names}")
        return ids

    def member_ids(self, values, project_id=None) -> list[str]:
        """Resolve "me", emails, display names or ids to user ids of active members."""
        if project_id:
            members = ProjectMember.objects.filter(project_id=project_id, is_active=True).select_related("member")
        else:
            members = WorkspaceMember.objects.filter(workspace__slug=self.slug, is_active=True).select_related("member")
        ids, missing = [], []
        for value in as_list(values):
            value = str(value).strip()
            if value.lower() in ("me", "我", "self"):
                ids.append(str(self.user.id))
                continue
            membership = (
                members.filter(member_id=value).first()
                if is_uuid(value)
                else members.filter(Q(member__email__iexact=value) | Q(member__display_name__iexact=value)).first()
            )
            (ids.append(str(membership.member_id)) if membership else missing.append(value))
        if missing:
            raise ToolError(
                f"找不到成员 {', '.join(missing)}。可传 me、邮箱或显示名，用 project(action='members') 查看成员。"
            )
        return ids

    def cycle_id(self, project_id, value) -> str:
        return self._named(Cycle, project_id, value, "周期", "cycle")

    def module_id(self, project_id, value) -> str:
        return self._named(Module, project_id, value, "模块", "module")

    def _named(self, model, project_id, value, label, tool) -> str:
        if not value:
            raise ToolError(f"缺少{label}：请传{label}名称或 ID。")
        objects = model.objects.filter(project_id=project_id)
        obj = objects.filter(pk=value).first() if is_uuid(value) else None
        obj = obj or objects.filter(name__iexact=str(value).strip()).first()
        if obj is None:
            raise ToolError(f"找不到{label} {value}。可用 {tool}(action='list') 查看。")
        return str(obj.id)


@dataclass
class Action:
    name: str
    description: str
    handler: Callable[[Context, dict], Any]
    params: dict = field(default_factory=dict)  # name -> JSON schema (with description)
    required: tuple = ()
    read_only: bool = False
    destructive: bool = False


@dataclass
class Tool:
    name: str
    title: str
    description: str
    actions: list

    def action(self, name):
        return next((a for a in self.actions if a.name == name), None)

    def definition(self) -> dict:
        properties = {
            "workspace_slug": {
                "type": "string",
                "minLength": 1,
                "description": "本次调用的工作区 slug。除 workspace(action='list') 外必须显式提供。",
            },
            "action": {
                "type": "string",
                "enum": [a.name for a in self.actions],
                "description": "要执行的操作",
            },
        }
        for action in self.actions:
            for name, schema in action.params.items():
                properties.setdefault(name, schema)
        lines = [self.description, "", "操作："]
        for action in self.actions:
            params = [f"{p}{'（必填）' if p in action.required else ''}" for p in action.params]
            lines.append(f"- {action.name}：{action.description}" + (f" 参数：{', '.join(params)}" if params else ""))
        return {
            "name": self.name,
            "title": self.title,
            "description": "\n".join(lines),
            "inputSchema": {
                "type": "object",
                "properties": properties,
                "required": ["action"] if self.name == "workspace" else ["action", "workspace_slug"],
                **(
                    {
                        "anyOf": [
                            {"properties": {"action": {"const": "list"}}},
                            {"required": ["workspace_slug"]},
                        ]
                    }
                    if self.name == "workspace"
                    else {}
                ),
                "additionalProperties": False,
            },
            "annotations": {
                "title": self.title,
                "readOnlyHint": all(a.read_only for a in self.actions),
                "destructiveHint": any(a.destructive for a in self.actions),
                "idempotentHint": False,
                "openWorldHint": False,
            },
        }

    def run(self, ctx: Context, arguments: dict):
        arguments = dict(arguments or {})
        has_workspace = "workspace_slug" in arguments
        slug = arguments.pop("workspace_slug", None)
        listing = self.name == "workspace" and arguments.get("action") == "list"
        if not listing or has_workspace:
            if not isinstance(slug, str) or not slug.strip():
                raise ToolError("缺少有效的 workspace_slug：每次操作必须显式指定工作区。")
            if slug != ctx.slug:
                raise ToolError("workspace_slug 与本次授权工作区不匹配。")
        action = self.action(arguments.pop("action", None))
        if action is None:
            raise ToolError(f"未知操作。{self.name} 支持：{', '.join(a.name for a in self.actions)}")
        unknown = sorted(set(arguments) - set(action.params))
        if unknown:
            allowed = ", ".join(action.params) or "（无）"
            raise ToolError(f"{self.name}(action='{action.name}') 不接受参数 {', '.join(unknown)}。可用参数：{allowed}")
        missing = [p for p in action.required if arguments.get(p) in (None, "", [])]
        if missing:
            raise ToolError(f"{self.name}(action='{action.name}') 缺少必填参数：{', '.join(missing)}")
        return action.handler(ctx, arguments)


# -- helpers -----------------------------------------------------------------


def raise_for_status(result: ApiResult):
    if result.ok:
        return result.data
    data = result.data if isinstance(result.data, dict) else {"error": result.data}
    message = data.get("error") or data.get("detail") or data.get("message") or data
    if result.status == 401:
        raise ToolError("API Key 无效或已过期。")
    if result.status == 403:
        raise ToolError(f"没有权限执行此操作：{message}")
    if result.status == 404:
        raise ToolError(f"未找到：{message}")
    if result.status == 429:
        raise ToolError("请求过于频繁，已被限流，请稍后再试。")
    raise ToolError(f"操作失败（HTTP {result.status}）：{compact(message) if isinstance(message, dict) else message}")


def is_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return list(value)
    return [v.strip() for v in str(value).split(",") if v.strip()]


def pick(args: dict, *keys) -> dict:
    return {k: args[k] for k in keys if args.get(k) is not None}


# Reusable parameter schemas (descriptions in Chinese for the model)
P_PROJECT = {"type": "string", "description": "项目标识（如 WEB）、名称或 ID"}
P_WORK_ITEM = {"type": "string", "description": "工作项编号（如 WEB-12）或 ID"}
P_CURSOR = {"type": "string", "description": "分页游标，取自上一页结果的 next_cursor"}
P_PER_PAGE = {"type": "integer", "description": f"每页条数，默认 {DEFAULT_PER_PAGE}，最多 {MAX_PER_PAGE}"}
P_NAME = {"type": "string", "description": "名称"}
P_DESCRIPTION = {"type": "string", "description": "描述，Markdown 格式"}
P_DATE = {"type": "string", "description": "日期 YYYY-MM-DD"}
P_FILTERS = {
    "type": "object",
    "description": (
        "筛选条件（JSON 树，可用 and/or/not 组合）。字段：state_group(backlog/unstarted/started/completed/cancelled)、"
        "state_id、priority(urgent/high/medium/low/none)、assignee_id、label_id、cycle_id、module_id、parent_id、"
        "created_by_id、start_date、target_date；加 __in 传逗号分隔的多个值，"
        "日期加 __range 传 'YYYY-MM-DD,YYYY-MM-DD'。"
        '例：{"and":[{"state_group__in":"started"},{"priority__in":"urgent,high"}]}'
    ),
}
