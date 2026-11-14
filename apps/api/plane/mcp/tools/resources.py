# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Plane resources exposed as MCP tools. Each handler maps to public ``/api/v1/`` calls."""

# Python imports
import json
import logging

# Module imports
from plane.mcp.formatting import compact, markdown_to_html
from plane.mcp.images import MAX_IMAGES, work_item_images
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


def _list_workspaces(ctx, args):
    from plane.db.models import WorkspaceMember

    memberships = WorkspaceMember.objects.filter(member=ctx.user, is_active=True, workspace__deleted_at__isnull=True)
    if ctx.workspace_scope:
        memberships = memberships.filter(workspace__slug=ctx.workspace_scope)
    return [
        {
            "id": str(member.workspace_id),
            "slug": member.workspace.slug,
            "name": member.workspace.name,
            "role": member.role,
        }
        for member in memberships.select_related("workspace").order_by("created_at", "id")
    ]


def _me(ctx, args):
    me = compact(ctx.api_root("GET", "users/me/"))
    me["workspace"] = ctx.slug
    return me


MEMBER_WORK_PARAMS = {
    "projects": {
        "type": "array",
        "items": {"type": "string"},
        "description": "仅统计这些项目，传标识、名称或 ID；不传则统计有权限的项目",
    },
    "start_date": {"type": "string", "description": "截止日期范围起点 YYYY-MM-DD，须与 end_date 一起提供"},
    "end_date": {"type": "string", "description": "截止日期范围终点 YYYY-MM-DD，含当天"},
}


def _member_work(ctx, args):
    query = pick(args, "start_date", "end_date")
    if args.get("projects"):
        query["project_ids"] = ",".join(ctx.project_id(value) for value in as_list(args["projects"]))
    path = "member-work/"
    if "member" in args:
        member_id = ctx.member_ids([args["member"]])[0]
        path += f"{member_id}/items/"
        query.update(pick(args, "status", "page", "page_size"))
    # Member drill-down uses numbered pages, not the cursor pagination of workitem.list.
    return ctx.api("GET", path, query)


def _search(ctx, args):
    query = {"search": args["query"], "entities": ",".join(as_list(args.get("entities"))) or None}
    if args.get("project"):
        query["project_id"] = ctx.project_id(args["project"])
    query["limit"] = args.get("limit")
    return ctx.api("GET", "search/", query)["results"]


workspace_tool = Tool(
    name="workspace",
    title="工作区",
    description="列出可访问工作区，查看当前用户、指定工作区成员，并在指定工作区内搜索项目、工作项或页面。",
    actions=[
        Action(
            "list", "列出当前用户加入的活跃工作区（工作区 token 仅返回其授权工作区）", _list_workspaces, read_only=True
        ),
        Action("me", "当前登录用户及所在工作区", _me, read_only=True),
        Action(
            "members",
            "工作区成员列表（含 ID、邮箱、显示名，用于指派负责人）",
            lambda ctx, a: compact(ctx.api("GET", "members/")),
            read_only=True,
        ),
        Action(
            "member_work",
            "成员工作概览：当前分配量、状态、逾期、延期完成及原因评审计数；按项目时区和截止日期统计",
            _member_work,
            params=MEMBER_WORK_PARAMS,
            read_only=True,
        ),
        Action(
            "member_work_items",
            "成员工作明细；按返回 next_page 继续传 page 翻页，不使用 cursor",
            _member_work,
            params={
                **MEMBER_WORK_PARAMS,
                "member": {"type": "string", "description": "成员：me、邮箱、显示名或 ID"},
                "status": {
                    "type": "string",
                    "enum": ["all", "overdue", "late_completed", "justified", "unjustified", "unreviewed"],
                    "description": "明细类别，默认 all；评审状态本身不等于逾期，需根据日期及状态核实",
                },
                "page": {"type": "integer", "minimum": 1, "description": "页码，默认 1，后续使用 next_page"},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 100, "description": "每页条数，默认 20"},
            },
            required=("member",),
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


REMINDER_FIELDS = ("remind_in", "remind_email_enabled", "remind_feishu_enabled", "timezone")


def _reminder_settings(ctx, args):
    path = _project_path(ctx, args)
    body = pick(args, *REMINDER_FIELDS)
    if body:
        ctx.api("PATCH", path, body=body)
    project = ctx.api("GET", path)
    return {key: project.get(key) for key in ("id", "name", *REMINDER_FIELDS)}


def _update_reminder_settings(ctx, args):
    if not pick(args, *REMINDER_FIELDS):
        raise ToolError("没有要修改的提醒设置。")
    return _reminder_settings(ctx, args)


def _set_default_state(ctx, args):
    project_id = ctx.project_id(args.get("project"))
    state_id = ctx.state_id(project_id, args["state"])
    ctx.api("POST", f"projects/{project_id}/states/{state_id}/mark-default/")
    return {"default_state": args["state"]}


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
            "reminder_settings",
            "读取项目到期提醒配置和时区；配置开启不代表已投递成功",
            _reminder_settings,
            params={"project": P_PROJECT},
            required=("project",),
            read_only=True,
        ),
        Action(
            "update_reminder_settings",
            "修改到期提醒配置（仅管理员），未传字段保持原值，变更写入项目审计",
            _update_reminder_settings,
            params={
                "project": P_PROJECT,
                "remind_in": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 7,
                    "description": "提前提醒天数，0 关闭，最多 7 天",
                },
                "remind_email_enabled": {"type": "boolean", "description": "启用邮件提醒"},
                "remind_feishu_enabled": {"type": "boolean", "description": "启用飞书提醒"},
                "timezone": {"type": "string", "description": "项目 IANA 时区，如 Asia/Shanghai"},
            },
            required=("project",),
        ),
        Action(
            "activities",
            "项目配置变更审计：操作者、字段、旧值、新值及时间",
            lambda ctx, a: ctx.list_page(_project_path(ctx, a, "activities/"), a),
            params={"project": P_PROJECT, **PAGING},
            required=("project",),
            read_only=True,
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
            "check_identifier",
            "检查项目标识是否已被占用（创建项目前用）",
            lambda ctx, a: {
                "identifier": a["identifier"].upper(),
                "available": not ctx.api("GET", "project-identifiers/", {"name": a["identifier"].upper()})["exists"],
            },
            params={"identifier": {"type": "string", "description": "拟用的项目标识"}},
            required=("identifier",),
            read_only=True,
        ),
        Action(
            "set_default_state",
            "设为新工作项的默认状态（仅项目管理员）",
            _set_default_state,
            params={"project": P_PROJECT, "state": {"type": "string", "description": "状态名称或 ID"}},
            required=("project", "state"),
        ),
        Action(
            "create_labels",
            "批量创建标签（已存在的同名标签会跳过），最多 100 个",
            lambda ctx, a: compact(
                ctx.api(
                    "POST",
                    _project_path(ctx, a, "labels/bulk/"),
                    body={"labels": [{"name": n} for n in as_list(a["names"])]},
                )
            ),
            params={
                "project": P_PROJECT,
                "names": {"type": "array", "items": {"type": "string"}, "description": "标签名列表"},
            },
            required=("project", "names"),
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
        body["parent"] = ctx.work_item(args["parent"], project_id, include_archived=True)[1] if args["parent"] else None
    body.update(pick(args, "external_id", "external_source"))
    return body


def _work_item_path(ctx, args, suffix=""):
    project_id, work_item_id = ctx.work_item(
        args.get("work_item"), args.get("project"), include_archived=args.get("include_archived", False)
    )
    return f"projects/{project_id}/work-items/{work_item_id}/{suffix}"


def _list_work_items(ctx, args):
    query = {"expand": WORK_ITEM_EXPAND, "order_by": args.get("order_by")}
    if args.get("filters"):
        query["filters"] = json.dumps(args["filters"])
    return ctx.list_page(_project_path(ctx, args, "work-items/"), args, query)


def _get_work_item(ctx, args):
    return compact(
        ctx.api(
            "GET",
            _work_item_path(ctx, args),
            {
                "expand": WORK_ITEM_EXPAND,
                "include_archived": "true" if args.get("include_archived") else None,
            },
        )
    )


def _relations(ctx, args, method="GET"):
    relation = args.get("relation_type")
    if relation == "blocks":
        relation = "blocking"
    body = None
    if method != "GET":
        body = {
            "relation_type": relation,
            "issues": [ctx.work_item(value)[1] for value in as_list(args["related_items"])],
        }
    path = _work_item_path(ctx, args, "relations/")
    ctx.api(method, path, body=body) if method != "GET" else None
    result = ctx.api("GET", path)
    result["blocks"] = result.pop("blocking", [])
    return result


EXTERNAL_FIELDS = {
    "external_source": {"type": "string", "description": "外部来源命名空间，和 external_id 一起唯一定位"},
    "external_id": {"type": "string", "description": "外部稳定 ID / local_id，和 external_source 配对"},
}


def _by_external_id(ctx, args):
    return compact(
        ctx.api(
            "GET",
            _project_path(ctx, args, "work-items/"),
            {
                **pick(args, "external_id", "external_source"),
                "include_archived": "true",
                "expand": WORK_ITEM_EXPAND,
            },
        )
    )


def _upsert_work_item(ctx, args):
    project_id = ctx.project_id(args["project"])
    body = _work_item_body(ctx, project_id, args)
    item = ctx.api("PUT", f"projects/{project_id}/work-items/upsert/", body=body)
    return compact(
        ctx.api(
            "GET",
            f"projects/{project_id}/work-items/{item['id']}/",
            {
                "expand": WORK_ITEM_EXPAND,
                "include_archived": "true",
            },
        )
    )


def _bulk_upsert(ctx, args):
    items = args["items"]
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise ToolError("items 必须包含 1–100 个工作项。")
    results = []
    seen = set()
    for item in items:
        external_id = item.get("external_id") if isinstance(item, dict) else None
        if not isinstance(external_id, str) or not external_id.strip() or external_id in seen:
            raise ToolError("每项须有非空且批内唯一的 external_id。")
        if set(item) - set(WORK_ITEM_FIELDS) - {"external_id"}:
            raise ToolError(
                f"不支持的工作项字段：{', '.join(sorted(set(item) - set(WORK_ITEM_FIELDS) - {'external_id'}))}"
            )
        seen.add(external_id)
    for item in items:
        try:
            result = _upsert_work_item(
                ctx, {**item, "project": args["project"], "external_source": args["external_source"]}
            )
            results.append({"external_id": item["external_id"], "status": "succeeded", "work_item": result})
        except ToolError as exc:
            status = "unknown" if "HTTP 5" in str(exc) else "failed"
            results.append({"external_id": item["external_id"], "status": status, "error": str(exc)})
        except Exception:
            logging.getLogger(__name__).exception("MCP bulk upsert result is uncertain")
            results.append(
                {
                    "external_id": item["external_id"],
                    "status": "unknown",
                    "error": "结果未确认，请按外部 ID 读取核验后再重试。",
                }
            )
    return {
        "results": results,
        "succeeded": sum(row["status"] == "succeeded" for row in results),
        "failed": sum(row["status"] == "failed" for row in results),
        "unknown": sum(row["status"] == "unknown" for row in results),
    }


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
            "archived",
            "已归档工作项（含子任务、UUID、parent 和 archived_at），独立 cursor 分页；普通 list 不含归档",
            lambda ctx, a: ctx.list_page(
                _project_path(ctx, a, "archived-work-items/"), a, {"expand": WORK_ITEM_EXPAND}
            ),
            params={"project": P_PROJECT, **PAGING},
            required=("project",),
            read_only=True,
        ),
        Action(
            "get_by_external_id",
            "按项目、外部来源和稳定 ID 精确查询单对象，含归档与子任务；未命中报错，重复匹配报冲突",
            _by_external_id,
            params={"project": P_PROJECT, **EXTERNAL_FIELDS},
            required=("project", "external_source", "external_id"),
            read_only=True,
        ),
        Action(
            "upsert",
            "按外部来源+稳定ID幂等创建或更新；未知结果先 get_by_external_id 核验；归档命中保持归档",
            _upsert_work_item,
            params={"project": P_PROJECT, **EXTERNAL_FIELDS, **WORK_ITEM_FIELDS},
            required=("project", "external_source", "external_id"),
        ),
        Action(
            "bulk_upsert",
            "最多100项按稳定外部ID逐项幂等写入并返回各项结果；非整批事务，失败先核验再重试",
            _bulk_upsert,
            params={
                "project": P_PROJECT,
                "external_source": EXTERNAL_FIELDS["external_source"],
                "items": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 100,
                    "items": {
                        "type": "object",
                        "properties": {**WORK_ITEM_FIELDS, "external_id": EXTERNAL_FIELDS["external_id"]},
                        "required": ["external_id"],
                        "additionalProperties": False,
                    },
                },
            },
            required=("project", "external_source", "items"),
        ),
        Action(
            "relations",
            "原生关系：blocks 表示本工作项阻塞目标，blocked_by 表示本工作项被目标阻塞",
            _relations,
            params={"work_item": P_WORK_ITEM, "project": P_PROJECT},
            required=("work_item",),
            read_only=True,
        ),
        *[
            Action(
                name,
                "幂等"
                + ("新增" if method == "POST" else "移除")
                + "原生依赖并回读；blocks=本项阻塞目标，blocked_by=本项被目标阻塞",
                lambda ctx, a, method=method: _relations(ctx, a, method),
                params={
                    "work_item": P_WORK_ITEM,
                    "project": P_PROJECT,
                    "relation_type": {
                        "type": "string",
                        "enum": ["blocks", "blocked_by"],
                        "description": "从当前工作项视角解释方向",
                    },
                    "related_items": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 100,
                        "items": {"type": "string"},
                        "description": "目标编号或 UUID 列表",
                    },
                },
                required=("work_item", "relation_type", "related_items"),
            )
            for name, method in [("add_relation", "POST"), ("remove_relation", "DELETE")]
        ],
        Action(
            "get",
            "工作项详情，可选 project 校验归属，读取归档须 include_archived=true",
            _get_work_item,
            params={
                "work_item": P_WORK_ITEM,
                "project": P_PROJECT,
                "include_archived": {"type": "boolean", "description": "true 允许读取归档，默认 false"},
            },
            required=("work_item",),
            read_only=True,
        ),
        Action(
            "images",
            f"查看描述、评论和附件中的图片（正文里写作 ![图片](asset:ID)），每次最多 {MAX_IMAGES} 张",
            work_item_images,
            params={
                "work_item": P_WORK_ITEM,
                "images": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": f"要看的图片序号（从 1 开始）或资产 ID；不传则返回前 {MAX_IMAGES} 张",
                },
            },
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
            "comment_reviews",
            "读取评论原因评审的当前状态、是否因编辑失效及历史；同时返回 can_review",
            lambda ctx, a: ctx.api("GET", _work_item_path(ctx, a, "comment-reviews/")),
            params={"work_item": P_WORK_ITEM},
            required=("work_item",),
            read_only=True,
        ),
        Action(
            "review_comment",
            "评审评论原因（仅管理员、禁止自审）；评论编辑后评审失效，重新评审追加历史",
            lambda ctx, a: ctx.api(
                "POST",
                _work_item_path(ctx, a, f"comments/{a['comment_id']}/review/"),
                body={"status": a["review_status"]},
            ),
            params={
                "work_item": P_WORK_ITEM,
                "comment_id": {
                    "type": "string",
                    "format": "uuid",
                    "description": "评论 ID，取自 comments 或 comment_reviews",
                },
                "review_status": {
                    "type": "string",
                    "enum": ["justified", "unjustified", "unreviewed"],
                    "description": "原因合理、不合理或重置为未评审",
                },
            },
            required=("work_item", "comment_id", "review_status"),
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
            lambda ctx, a: ctx.api("DELETE", _work_item_path(ctx, {**a, "include_archived": True}, "archive/"))
            or {"unarchived": a["work_item"]},
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

    def body_of(ctx, args):
        body = pick(args, "name", *date_fields)
        if "description" in args:
            body["description"] = args["description"]
        if kind == "module":
            project_id = ctx.project_id(args.get("project"))
            if "lead" in args:
                body["lead"] = ctx.member_ids([args["lead"]], project_id)[0] if args["lead"] else None
            if "members" in args:
                body["members"] = ctx.member_ids(args["members"], project_id)
        return body

    def create(ctx, args):
        project_id = ctx.project_id(args.get("project"))
        body = {**body_of(ctx, args), "project_id": project_id}
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
    ownership = (
        {
            "lead": {
                "type": ["string", "null"],
                "description": "模块负责人：me、项目成员邮箱/名称/UUID；null或空字符串清空，省略保留",
            },
            "members": {
                "type": "array",
                "items": {"type": "string"},
                "description": "模块成员：me、邮箱/名称/UUID；更新时全量替换，[]清空，省略保留",
            },
        }
        if kind == "module"
        else {}
    )
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
                params={"project": P_PROJECT, "name": P_NAME, "description": {"type": "string"}, **dates, **ownership},
                required=("project", "name"),
            ),
            Action(
                "update",
                f"修改{label}",
                lambda ctx, a: compact(ctx.api("PATCH", container_path(ctx, a)[1], body=body_of(ctx, a))),
                params={
                    "project": P_PROJECT,
                    **ref,
                    "name": P_NAME,
                    "description": {"type": "string"},
                    **dates,
                    **ownership,
                },
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


def _cycle_path(ctx, args, suffix):
    project_id = ctx.project_id(args.get("project"))
    return f"projects/{project_id}/cycles/{ctx.cycle_id(project_id, args.get('cycle'))}/{suffix}"


def _module_path(ctx, args, suffix):
    project_id = ctx.project_id(args.get("project"))
    return f"projects/{project_id}/modules/{ctx.module_id(project_id, args.get('module'))}/{suffix}"


P_CYCLE = {"type": "string", "description": "周期名称或 ID"}
P_MODULE = {"type": "string", "description": "模块名称或 ID"}

cycle_tool.actions += [
    Action(
        "progress",
        "周期进度：各状态组的工作项数与估算点数",
        lambda ctx, a: ctx.api("GET", _cycle_path(ctx, a, "progress/")),
        params={"project": P_PROJECT, "cycle": P_CYCLE},
        required=("project", "cycle"),
        read_only=True,
    ),
    Action(
        "burndown",
        "燃尽数据（completion_chart，每日剩余量）及按负责人、标签的分布",
        lambda ctx, a: compact(
            ctx.api("GET", _cycle_path(ctx, a, "analytics/"), {"type": "points" if a.get("points") else "issues"})
        ),
        params={
            "project": P_PROJECT,
            "cycle": P_CYCLE,
            "points": {"type": "boolean", "description": "true 按估算点数统计，默认按工作项数"},
        },
        required=("project", "cycle"),
        read_only=True,
    ),
]

module_tool.actions += [
    Action(
        "links",
        "模块的外部链接",
        lambda ctx, a: compact(ctx.api("GET", _module_path(ctx, a, "links/"))),
        params={"project": P_PROJECT, "module": P_MODULE},
        required=("project", "module"),
        read_only=True,
    ),
    Action(
        "add_link",
        "给模块添加外部链接",
        lambda ctx, a: compact(
            ctx.api("POST", _module_path(ctx, a, "links/"), body={"url": a["url"], "title": a.get("title") or a["url"]})
        ),
        params={"project": P_PROJECT, "module": P_MODULE, "url": {"type": "string"}, "title": {"type": "string"}},
        required=("project", "module", "url"),
    ),
]


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
