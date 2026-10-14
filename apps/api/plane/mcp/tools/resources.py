# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Plane resources exposed as MCP tools. Each handler maps to public ``/api/v1/`` calls."""

# Python imports
import json

# Module imports
from plane.mcp.formatting import compact, markdown_to_html
from plane.mcp.tools.base import (
    P_CURSOR,
    P_DATE,
    P_DESCRIPTION,
    P_FILTERS,
    P_NAME,
    P_PER_PAGE,
    P_PROJECT,
    P_WORK_ITEM,
    Action,
    Tool,
    ToolError,
    as_list,
    pick,
)

PAGING = {"cursor": P_CURSOR, "per_page": P_PER_PAGE}
WORK_ITEM_EXPAND = "state,assignees,labels,parent"


def _project_path(ctx, args, suffix=""):
    return f"projects/{ctx.project_id(args.get('project'))}/{suffix}"


# -- workspace -------------------------------------------------------------------


def _me(ctx, args):
    me = compact(ctx.api_root("GET", "users/me/"))
    me["workspace"] = ctx.slug
    return me


def _search(ctx, args):
    query = {"search": args["query"], "entities": ",".join(as_list(args.get("entities"))) or None}
    if args.get("project"):
        query["project_id"] = ctx.project_id(args["project"])
    query["limit"] = args.get("limit")
    return ctx.api("GET", "search/", query)["results"]


workspace_tool = Tool(
    name="workspace",
    title="工作区",
    description="当前用户、工作区成员与全局搜索。不确定某个项目、工作项或页面在哪时，先用 search。",
    actions=[
        Action("me", "当前登录用户及所在工作区", _me, read_only=True),
        Action(
            "members",
            "工作区成员列表（含 ID、邮箱、显示名，用于指派负责人）",
            lambda ctx, a: compact(ctx.api("GET", "members/")),
            read_only=True,
        ),
        Action(
            "search",
            "按名称搜索项目、工作项（支持 WEB-12 编号）、周期、模块、页面、视图",
            _search,
            params={
                "query": {"type": "string", "description": "搜索词"},
                "entities": {
                    "type": "string",
                    "description": "只搜这些类型，逗号分隔：project, work_item, cycle, module, page, view",
                },
                "project": P_PROJECT,
                "limit": {"type": "integer", "description": "每类返回条数，默认 10，最多 50"},
            },
            required=("query",),
            read_only=True,
        ),
    ],
)


# -- project ---------------------------------------------------------------------


def _project_body(args):
    body = pick(args, "name", "identifier")
    if "description" in args:
        body["description"] = args["description"]
    return body


project_tool = Tool(
    name="project",
    title="项目",
    description="项目，以及项目的状态、标签、成员。创建工作项前可用 states / labels 查看可选值。",
    actions=[
        Action("list", "我参与的项目", lambda ctx, a: ctx.list_page("projects/", a), params=PAGING, read_only=True),
        Action(
            "get",
            "项目详情",
            lambda ctx, a: compact(ctx.api("GET", _project_path(ctx, a))),
            params={"project": P_PROJECT},
            required=("project",),
            read_only=True,
        ),
        Action(
            "create",
            "创建项目（创建者成为管理员）",
            lambda ctx, a: compact(ctx.api("POST", "projects/", body=_project_body(a))),
            params={
                "name": P_NAME,
                "identifier": {"type": "string", "description": "项目标识，大写字母或数字，最多 12 位，如 WEB"},
                "description": {"type": "string", "description": "项目描述（纯文本）"},
            },
            required=("name", "identifier"),
        ),
        Action(
            "update",
            "修改项目名称、标识或描述",
            lambda ctx, a: compact(ctx.api("PATCH", _project_path(ctx, a), body=_project_body(a))),
            params={
                "project": P_PROJECT,
                "name": P_NAME,
                "identifier": {"type": "string", "description": "新项目标识"},
                "description": {"type": "string", "description": "项目描述（纯文本）"},
            },
            required=("project",),
        ),
        Action(
            "states",
            "项目的状态列表（含状态组）",
            lambda ctx, a: ctx.list_page(_project_path(ctx, a, "states/"), a),
            params={"project": P_PROJECT, **PAGING},
            required=("project",),
            read_only=True,
        ),
        Action(
            "labels",
            "项目的标签列表",
            lambda ctx, a: ctx.list_page(_project_path(ctx, a, "labels/"), a),
            params={"project": P_PROJECT, **PAGING},
            required=("project",),
            read_only=True,
        ),
        Action(
            "create_label",
            "创建标签",
            lambda ctx, a: compact(ctx.api("POST", _project_path(ctx, a, "labels/"), body=pick(a, "name", "color"))),
            params={
                "project": P_PROJECT,
                "name": P_NAME,
                "color": {"type": "string", "description": "颜色，如 #FF5733"},
            },
            required=("project", "name"),
        ),
        Action(
            "members",
            "项目成员",
            lambda ctx, a: compact(ctx.api("GET", _project_path(ctx, a, "members/"))),
            params={"project": P_PROJECT},
            required=("project",),
            read_only=True,
        ),
    ],
)


# -- work item -------------------------------------------------------------------

WORK_ITEM_FIELDS = {
    "name": {"type": "string", "description": "标题"},
    "description": P_DESCRIPTION,
    "state": {"type": "string", "description": "状态名称或 ID"},
    "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low", "none"], "description": "优先级"},
    "assignees": {
        "type": "array",
        "items": {"type": "string"},
        "description": "负责人：me、邮箱、显示名或 ID；更新时会整体替换",
    },
    "labels": {"type": "array", "items": {"type": "string"}, "description": "标签名称或 ID；更新时会整体替换"},
    "parent": {"type": "string", "description": "父工作项编号或 ID；传空字符串可清除"},
    "start_date": P_DATE,
    "target_date": {"type": "string", "description": "截止日期 YYYY-MM-DD"},
}


def _work_item_body(ctx, project_id, args):
    body = pick(args, "name", "priority", "start_date", "target_date")
    if "description" in args:
        body["description_html"] = markdown_to_html(args["description"])
    if args.get("state"):
        body["state"] = ctx.state_id(project_id, args["state"])
    if "assignees" in args:
        body["assignees"] = ctx.member_ids(args["assignees"], project_id)
    if "labels" in args:
        body["labels"] = ctx.label_ids(project_id, args["labels"])
    if "parent" in args:
        body["parent"] = ctx.work_item(args["parent"])[1] if args["parent"] else None
    return body


def _work_item_path(ctx, args, suffix=""):
    project_id, work_item_id = ctx.work_item(args.get("work_item"))
    return f"projects/{project_id}/work-items/{work_item_id}/{suffix}"


def _list_work_items(ctx, args):
    query = {"expand": WORK_ITEM_EXPAND, "order_by": args.get("order_by")}
    if args.get("filters"):
        query["filters"] = json.dumps(args["filters"])
    return ctx.list_page(_project_path(ctx, args, "work-items/"), args, query)


def _get_work_item(ctx, args):
    return compact(ctx.api("GET", _work_item_path(ctx, args), {"expand": WORK_ITEM_EXPAND}))


def _create_work_item(ctx, args):
    project_id = ctx.project_id(args.get("project"))
    body = _work_item_body(ctx, project_id, args)
    created = ctx.api("POST", f"projects/{project_id}/work-items/", body=body)
    return compact(ctx.api("GET", f"projects/{project_id}/work-items/{created['id']}/", {"expand": WORK_ITEM_EXPAND}))


def _update_work_item(ctx, args):
    project_id, work_item_id = ctx.work_item(args.get("work_item"))
    body = _work_item_body(ctx, project_id, args)
    if not body:
        raise ToolError("没有要修改的字段。")
    ctx.api("PATCH", f"projects/{project_id}/work-items/{work_item_id}/", body=body)
    return compact(ctx.api("GET", f"projects/{project_id}/work-items/{work_item_id}/", {"expand": WORK_ITEM_EXPAND}))


def _my_work_items(ctx, args):
    query = {"type": args.get("type") or "assigned", "expand": WORK_ITEM_EXPAND}
    if args.get("filters"):
        query["filters"] = json.dumps(args["filters"])
    return ctx.list_page("me/work-items/", args, query)


def _add_sub_items(ctx, args):
    sub_ids = [ctx.work_item(value)[1] for value in as_list(args["sub_items"])]
    return compact(ctx.api("POST", _work_item_path(ctx, args, "sub-items/"), body={"sub_work_item_ids": sub_ids}))


def _remove_sub_item(ctx, args):
    sub_id = ctx.work_item(args["sub_item"])[1]
    ctx.api("DELETE", _work_item_path(ctx, args, f"sub-items/{sub_id}/"))
    return {"removed": args["sub_item"]}


def _bulk_archive(ctx, args):
    resolved = [ctx.work_item(value) for value in as_list(args["work_items"])]
    projects = {project_id for project_id, _ in resolved}
    if len(projects) != 1:
        raise ToolError("批量归档的工作项必须属于同一个项目。")
    body = {"work_item_ids": [work_item_id for _, work_item_id in resolved]}
    return ctx.api("POST", f"projects/{projects.pop()}/work-items/bulk-archive/", body=body)


def _delete_work_item(ctx, args):
    ctx.api("DELETE", _work_item_path(ctx, args))
    return {"deleted": args["work_item"]}


workitem_tool = Tool(
    name="workitem",
    title="工作项",
    description=(
        "工作项（任务）。用 WEB-12 这样的编号定位；状态、标签、负责人都可以直接传名称。正文和评论使用 Markdown。"
    ),
    actions=[
        Action(
            "list",
            "项目内的工作项，可按 filters 筛选",
            _list_work_items,
            params={
                "project": P_PROJECT,
                "filters": P_FILTERS,
                "order_by": {
                    "type": "string",
                    "description": "排序：-created_at（默认）、-updated_at、priority、target_date 等，加 - 为倒序",
                },
                **PAGING,
            },
            required=("project",),
            read_only=True,
        ),
        Action(
            "get",
            "工作项详情",
            _get_work_item,
            params={"work_item": P_WORK_ITEM},
            required=("work_item",),
            read_only=True,
        ),
        Action(
            "create",
            "创建工作项",
            _create_work_item,
            params={"project": P_PROJECT, **WORK_ITEM_FIELDS},
            required=("project", "name"),
        ),
        Action(
            "update",
            "修改工作项（只改传入的字段）",
            _update_work_item,
            params={"work_item": P_WORK_ITEM, **WORK_ITEM_FIELDS},
            required=("work_item",),
        ),
        Action(
            "delete",
            "删除工作项（仅创建者或管理员）",
            _delete_work_item,
            params={"work_item": P_WORK_ITEM},
            required=("work_item",),
            destructive=True,
        ),
        Action(
            "my_items",
            "跨项目的我的工作项：分配给我（默认）、我创建、我关注",
            _my_work_items,
            params={
                "type": {"type": "string", "enum": ["assigned", "created", "subscribed"], "description": "类型"},
                "filters": P_FILTERS,
                **PAGING,
            },
            read_only=True,
        ),
        Action(
            "my_summary",
            "我的工作汇总：按状态组计数、逾期、7 天内到期",
            lambda ctx, a: ctx.api("GET", "me/work-items/summary/"),
            read_only=True,
        ),
        Action(
            "comments",
            "工作项评论",
            lambda ctx, a: ctx.list_page(_work_item_path(ctx, a, "comments/"), a),
            params={"work_item": P_WORK_ITEM, **PAGING},
            required=("work_item",),
            read_only=True,
        ),
        Action(
            "add_comment",
            "发表评论（Markdown）",
            lambda ctx, a: compact(
                ctx.api(
                    "POST", _work_item_path(ctx, a, "comments/"), body={"comment_html": markdown_to_html(a["comment"])}
                )
            ),
            params={"work_item": P_WORK_ITEM, "comment": {"type": "string", "description": "评论内容，Markdown"}},
            required=("work_item", "comment"),
        ),
        Action(
            "activities",
            "工作项的变更记录",
            lambda ctx, a: ctx.list_page(_work_item_path(ctx, a, "activities/"), a),
            params={"work_item": P_WORK_ITEM, **PAGING},
            required=("work_item",),
            read_only=True,
        ),
        Action(
            "sub_items",
            "子工作项列表",
            lambda ctx, a: ctx.list_page(_work_item_path(ctx, a, "sub-items/"), a),
            params={"work_item": P_WORK_ITEM, **PAGING},
            required=("work_item",),
            read_only=True,
        ),
        Action(
            "add_sub_items",
            "把若干工作项挂为子工作项（同一项目）",
            _add_sub_items,
            params={
                "work_item": P_WORK_ITEM,
                "sub_items": {"type": "array", "items": {"type": "string"}, "description": "子工作项编号列表"},
            },
            required=("work_item", "sub_items"),
        ),
        Action(
            "remove_sub_item",
            "解除父子关系（不删除子工作项）",
            _remove_sub_item,
            params={"work_item": P_WORK_ITEM, "sub_item": {"type": "string", "description": "子工作项编号"}},
            required=("work_item", "sub_item"),
        ),
        Action(
            "archive",
            "归档（仅已完成或已取消状态）",
            lambda ctx, a: ctx.api("POST", _work_item_path(ctx, a, "archive/")),
            params={"work_item": P_WORK_ITEM},
            required=("work_item",),
        ),
        Action(
            "unarchive",
            "取消归档",
            lambda ctx, a: ctx.api("DELETE", _work_item_path(ctx, a, "archive/")) or {"unarchived": a["work_item"]},
            params={"work_item": P_WORK_ITEM},
            required=("work_item",),
        ),
        Action(
            "subscribe",
            "关注工作项（有变化时收到通知）",
            lambda ctx, a: ctx.api("POST", _work_item_path(ctx, a, "subscribe/")),
            params={"work_item": P_WORK_ITEM},
            required=("work_item",),
        ),
        Action(
            "unsubscribe",
            "取消关注",
            lambda ctx, a: ctx.api("DELETE", _work_item_path(ctx, a, "subscribe/")),
            params={"work_item": P_WORK_ITEM},
            required=("work_item",),
        ),
        Action(
            "react",
            "给工作项加表情回应",
            lambda ctx, a: ctx.api("POST", _work_item_path(ctx, a, "reactions/"), body={"reaction": a["reaction"]}),
            params={"work_item": P_WORK_ITEM, "reaction": {"type": "string", "description": "表情，如 👍"}},
            required=("work_item", "reaction"),
        ),
        Action(
            "bulk_archive",
            "批量归档，最多 100 条；有一条不满足条件就全部不执行",
            _bulk_archive,
            params={"work_items": {"type": "array", "items": {"type": "string"}, "description": "工作项编号列表"}},
            required=("work_items",),
        ),
    ],
)


# -- cycle & module ----------------------------------------------------------------


def _container_tool(kind, label, path, items_path, id_resolver, date_fields):
    def container_path(ctx, args, suffix=""):
        project_id = ctx.project_id(args.get("project"))
        container_id = id_resolver(ctx, project_id, args.get(kind))
        return project_id, f"projects/{project_id}/{path}/{container_id}/{suffix}"

    def body_of(args):
        body = pick(args, "name", *date_fields)
        if "description" in args:
            body["description"] = args["description"]
        return body

    def create(ctx, args):
        project_id = ctx.project_id(args.get("project"))
        body = {**body_of(args), "project_id": project_id}
        return compact(ctx.api("POST", f"projects/{project_id}/{path}/", body=body))

    def add_items(ctx, args):
        project_id, base = container_path(ctx, args)
        ids = [ctx.work_item(value, args.get("project"))[1] for value in as_list(args["work_items"])]
        return compact(ctx.api("POST", f"{base}{items_path}/", body={"issues": ids}))

    def remove_item(ctx, args):
        _, base = container_path(ctx, args)
        work_item_id = ctx.work_item(args["work_item"], args.get("project"))[1]
        ctx.api("DELETE", f"{base}{items_path}/{work_item_id}/")
        return {"removed": args["work_item"]}

    ref = {kind: {"type": "string", "description": f"{label}名称或 ID"}}
    dates = {name: P_DATE for name in date_fields}
    return Tool(
        name=kind,
        title=label,
        description=f"项目内的{label}，以及{label}中的工作项。",
        actions=[
            Action(
                "list",
                f"{label}列表",
                lambda ctx, a: ctx.list_page(f"projects/{ctx.project_id(a.get('project'))}/{path}/", a),
                params={"project": P_PROJECT, **PAGING},
                required=("project",),
                read_only=True,
            ),
            Action(
                "get",
                f"{label}详情（含进度统计）",
                lambda ctx, a: compact(ctx.api("GET", container_path(ctx, a)[1])),
                params={"project": P_PROJECT, **ref},
                required=("project", kind),
                read_only=True,
            ),
            Action(
                "create",
                f"创建{label}",
                create,
                params={"project": P_PROJECT, "name": P_NAME, "description": {"type": "string"}, **dates},
                required=("project", "name"),
            ),
            Action(
                "update",
                f"修改{label}",
                lambda ctx, a: compact(ctx.api("PATCH", container_path(ctx, a)[1], body=body_of(a))),
                params={"project": P_PROJECT, **ref, "name": P_NAME, "description": {"type": "string"}, **dates},
                required=("project", kind),
            ),
            Action(
                "items",
                f"{label}中的工作项",
                lambda ctx, a: ctx.list_page(container_path(ctx, a, f"{items_path}/")[1], a),
                params={"project": P_PROJECT, **ref, **PAGING},
                required=("project", kind),
                read_only=True,
            ),
            Action(
                "add_items",
                f"把工作项加入{label}",
                add_items,
                params={
                    "project": P_PROJECT,
                    **ref,
                    "work_items": {"type": "array", "items": {"type": "string"}, "description": "工作项编号列表"},
                },
                required=("project", kind, "work_items"),
            ),
            Action(
                "remove_item",
                f"把工作项移出{label}",
                remove_item,
                params={"project": P_PROJECT, **ref, "work_item": P_WORK_ITEM},
                required=("project", kind, "work_item"),
            ),
        ],
    )


cycle_tool = _container_tool(
    "cycle", "周期", "cycles", "cycle-issues", lambda ctx, p, v: ctx.cycle_id(p, v), ("start_date", "end_date")
)
module_tool = _container_tool(
    "module", "模块", "modules", "module-issues", lambda ctx, p, v: ctx.module_id(p, v), ("start_date", "target_date")
)


# -- page --------------------------------------------------------------------------

P_PAGE = {"type": "string", "description": "页面 ID"}


def _page_path(ctx, args, suffix=""):
    return _project_path(ctx, args, f"pages/{args.get('page')}/{suffix}")


def _page_body(args):
    body = pick(args, "name")
    if "content" in args:
        body["description_html"] = markdown_to_html(args["content"])
    if "access" in args:
        body["access"] = 1 if args["access"] == "private" else 0
    return body


page_tool = Tool(
    name="page",
    title="页面",
    description="项目文档页面。正文用 Markdown 读写；锁定的页面不能修改，归档的页面不能改正文。",
    actions=[
        Action(
            "list",
            "页面列表",
            lambda ctx, a: ctx.list_page(
                _project_path(ctx, a, "pages/"), a, {"search": a.get("search"), "archived": a.get("archived")}
            ),
            params={
                "project": P_PROJECT,
                "search": {"type": "string", "description": "按标题搜索"},
                "archived": {"type": "boolean", "description": "true 只看已归档"},
                **PAGING,
            },
            required=("project",),
            read_only=True,
        ),
        Action(
            "get",
            "读取页面（正文为 Markdown）",
            lambda ctx, a: compact(ctx.api("GET", _page_path(ctx, a))),
            params={"project": P_PROJECT, "page": P_PAGE},
            required=("project", "page"),
            read_only=True,
        ),
        Action(
            "create",
            "新建页面",
            lambda ctx, a: compact(ctx.api("POST", _project_path(ctx, a, "pages/"), body=_page_body(a))),
            params={
                "project": P_PROJECT,
                "name": {"type": "string", "description": "标题"},
                "content": {"type": "string", "description": "正文，Markdown"},
                "access": {"type": "string", "enum": ["public", "private"], "description": "默认 public"},
            },
            required=("project", "name"),
        ),
        Action(
            "update",
            "修改页面标题、正文（整体替换）或访问权限",
            lambda ctx, a: compact(ctx.api("PATCH", _page_path(ctx, a), body=_page_body(a))),
            params={
                "project": P_PROJECT,
                "page": P_PAGE,
                "name": {"type": "string", "description": "标题"},
                "content": {"type": "string", "description": "新正文，Markdown，会整体替换原正文"},
                "access": {"type": "string", "enum": ["public", "private"]},
            },
            required=("project", "page"),
        ),
        Action(
            "archive",
            "归档页面（连同子页面）",
            lambda ctx, a: ctx.api("POST", _page_path(ctx, a, "archive/")),
            params={"project": P_PROJECT, "page": P_PAGE},
            required=("project", "page"),
        ),
        Action(
            "unarchive",
            "取消归档",
            lambda ctx, a: ctx.api("DELETE", _page_path(ctx, a, "archive/")) or {"unarchived": a["page"]},
            params={"project": P_PROJECT, "page": P_PAGE},
            required=("project", "page"),
        ),
    ],
)


# -- view --------------------------------------------------------------------------


def _view_base(ctx, args):
    return _project_path(ctx, args, "views/") if args.get("project") else "views/"


def _view_body(args):
    body = pick(args, "name", "description")
    if "filters" in args:
        body["rich_filters"] = args["filters"]
    if "access" in args:
        body["access"] = 0 if args["access"] == "private" else 1
    return body


P_VIEW = {"type": "string", "description": "视图 ID"}
P_VIEW_PROJECT = {"type": "string", "description": "项目标识；不传则为工作区级视图"}

view_tool = Tool(
    name="view",
    title="视图",
    description="保存的工作项视图（筛选条件）。传 project 为项目视图，不传为工作区视图。",
    actions=[
        Action(
            "list",
            "视图列表",
            lambda ctx, a: ctx.list_page(_view_base(ctx, a), a),
            params={"project": P_VIEW_PROJECT, **PAGING},
            read_only=True,
        ),
        Action(
            "get",
            "视图详情",
            lambda ctx, a: compact(ctx.api("GET", f"{_view_base(ctx, a)}{a['view']}/")),
            params={"project": P_VIEW_PROJECT, "view": P_VIEW},
            required=("view",),
            read_only=True,
        ),
        Action(
            "items",
            "按视图筛选条件列出工作项",
            lambda ctx, a: ctx.list_page(
                f"{_view_base(ctx, a)}{a['view']}/work-items/", a, {"expand": WORK_ITEM_EXPAND}
            ),
            params={"project": P_VIEW_PROJECT, "view": P_VIEW, **PAGING},
            required=("view",),
            read_only=True,
        ),
        Action(
            "create",
            "保存一个视图",
            lambda ctx, a: compact(ctx.api("POST", _view_base(ctx, a), body=_view_body(a))),
            params={
                "project": P_VIEW_PROJECT,
                "name": P_NAME,
                "description": {"type": "string"},
                "filters": P_FILTERS,
                "access": {"type": "string", "enum": ["public", "private"], "description": "默认 public"},
            },
            required=("name",),
        ),
        Action(
            "update",
            "修改视图（仅创建者）",
            lambda ctx, a: compact(ctx.api("PATCH", f"{_view_base(ctx, a)}{a['view']}/", body=_view_body(a))),
            params={
                "project": P_VIEW_PROJECT,
                "view": P_VIEW,
                "name": P_NAME,
                "description": {"type": "string"},
                "filters": P_FILTERS,
                "access": {"type": "string", "enum": ["public", "private"]},
            },
            required=("view",),
        ),
        Action(
            "delete",
            "删除视图（创建者或管理员）",
            lambda ctx, a: ctx.api("DELETE", f"{_view_base(ctx, a)}{a['view']}/") or {"deleted": a["view"]},
            params={"project": P_VIEW_PROJECT, "view": P_VIEW},
            required=("view",),
            destructive=True,
        ),
    ],
)


# -- notification ------------------------------------------------------------------

P_NOTIFICATION = {"type": "string", "description": "通知 ID"}

notification_tool = Tool(
    name="notification",
    title="通知",
    description="我的通知：列表、未读数、标记已读、归档。",
    actions=[
        Action(
            "list",
            "我的通知，最新在前",
            lambda ctx, a: ctx.list_page(
                "notifications/",
                a,
                {"read": a.get("read"), "mentioned": a.get("mentioned"), "archived": a.get("archived")},
            ),
            params={
                "read": {"type": "boolean", "description": "false 只看未读"},
                "mentioned": {"type": "boolean", "description": "true 只看提及我的"},
                "archived": {"type": "boolean", "description": "true 只看已归档"},
                **PAGING,
            },
            read_only=True,
        ),
        Action("unread_count", "未读数", lambda ctx, a: ctx.api("GET", "notifications/unread-count/"), read_only=True),
        Action(
            "mark_read",
            "标记已读",
            lambda ctx, a: compact(ctx.api("POST", f"notifications/{a['notification']}/read/")),
            params={"notification": P_NOTIFICATION},
            required=("notification",),
        ),
        Action(
            "mark_unread",
            "标记未读",
            lambda ctx, a: compact(ctx.api("DELETE", f"notifications/{a['notification']}/read/")),
            params={"notification": P_NOTIFICATION},
            required=("notification",),
        ),
        Action(
            "archive",
            "归档通知",
            lambda ctx, a: compact(ctx.api("POST", f"notifications/{a['notification']}/archive/")),
            params={"notification": P_NOTIFICATION},
            required=("notification",),
        ),
        Action("mark_all_read", "全部标记已读", lambda ctx, a: ctx.api("POST", "notifications/mark-all-read/")),
    ],
)


# -- webhook -----------------------------------------------------------------------

P_WEBHOOK = {"type": "string", "description": "Webhook ID"}
P_EVENTS = {
    "type": "array",
    "items": {"type": "string"},
    "description": (
        "订阅的事件，如 issue、issue.created、issue.updated、issue.state_changed、issue.assigned、"
        "issue_comment.created、cycle、module、project"
    ),
}

webhook_tool = Tool(
    name="webhook",
    title="Webhook",
    description="管理我的个人 Webhook：Plane 中我能看到的变化会推送到指定 URL。工作区级 Webhook 仅管理员可建。",
    actions=[
        Action("list", "我的 Webhook", lambda ctx, a: compact(ctx.api("GET", "webhooks/")), read_only=True),
        Action(
            "create",
            "新建 Webhook（返回的 secret_key 只显示这一次，用于校验签名）",
            lambda ctx, a: compact(
                ctx.api("POST", "webhooks/", body={"url": a["url"], "events": as_list(a.get("events")) or ["issue"]})
            ),
            params={"url": {"type": "string", "description": "接收地址（https）"}, "events": P_EVENTS},
            required=("url",),
        ),
        Action(
            "update",
            "修改地址、订阅事件，或用 is_active=false 暂停",
            lambda ctx, a: compact(
                ctx.api(
                    "PATCH",
                    f"webhooks/{a['webhook']}/",
                    body={
                        **pick(a, "url", "is_active"),
                        **({"events": as_list(a["events"])} if "events" in a else {}),
                    },
                )
            ),
            params={
                "webhook": P_WEBHOOK,
                "url": {"type": "string"},
                "events": P_EVENTS,
                "is_active": {"type": "boolean"},
            },
            required=("webhook",),
        ),
        Action(
            "delete",
            "删除 Webhook",
            lambda ctx, a: ctx.api("DELETE", f"webhooks/{a['webhook']}/") or {"deleted": a["webhook"]},
            params={"webhook": P_WEBHOOK},
            required=("webhook",),
            destructive=True,
        ),
        Action(
            "logs",
            "最近的投递记录",
            lambda ctx, a: ctx.list_page(f"webhooks/{a['webhook']}/logs/", a),
            params={"webhook": P_WEBHOOK, **PAGING},
            required=("webhook",),
            read_only=True,
        ),
        Action(
            "test",
            "发送一条 ping 测试事件",
            lambda ctx, a: ctx.api("POST", f"webhooks/{a['webhook']}/test/"),
            params={"webhook": P_WEBHOOK},
            required=("webhook",),
        ),
    ],
)


TOOLS = [
    workspace_tool,
    project_tool,
    workitem_tool,
    cycle_tool,
    module_tool,
    page_tool,
    view_tool,
    notification_tool,
    webhook_tool,
]
TOOLS_BY_NAME = {tool.name: tool for tool in TOOLS}
