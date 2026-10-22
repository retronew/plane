# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Server instructions, sent to clients so the model knows Plane's vocabulary and common recipes."""

SERVER_INSTRUCTIONS = """\
你连接的是 Plane 项目管理系统。所有操作都以 OAuth 授权用户或 API Key 所属用户的身份和权限执行，并记录在其账号下。

术语：项目（project，用 WEB 这样的标识表示）、工作项（workitem，即任务，用 WEB-12 这样的编号表示）、
状态（state，属于 backlog / unstarted / started / completed / cancelled 五个状态组之一）、
周期（cycle，迭代）、模块（module）、页面（page，文档）、视图（view，保存的筛选条件）。

用法要点：
- 先用 workspace(action='list') 查看可访问的工作区；每次工具调用显式传 workspace_slug。
- 除工作区列表外，缺少 workspace_slug 或无权限都会报错，不会使用默认工作区。
- OAuth 连接仅能访问授权时选定的工作区，只读授权不能写入；需要写入时请用户重新连接并明确授权读写。
- 个人 API Key 可跨已加入的工作区；工作区 API Key 仍仅能访问其授权工作区。
- 不确定对象在哪时，先用 workspace(action='search', workspace_slug='目标工作区 slug')。
- 状态、标签、负责人可以直接传名称；负责人可以传 me、邮箱或显示名。
- 正文、评论、页面内容都用 Markdown。
- 列表结果带 next_cursor 时表示还有下一页，把它作为 cursor 传入即可。
- 删除、批量归档前先向用户确认。

常见流程：
- 我今天做什么：先 workitem(action='my_summary', workspace_slug='目标工作区 slug')，
  再 workitem(action='my_items', workspace_slug='目标工作区 slug', filters={"state_group__in":"unstarted,started"})。
- 拆需求：用 workitem(action='create', workspace_slug='目标工作区 slug') 建父工作项，
  再逐个创建子任务（传 parent），或用 add_sub_items 挂载已有工作项。
- 迭代规划：cycle(action='list', workspace_slug='目标工作区 slug') 找到周期，
  再 cycle(action='add_items', workspace_slug='目标工作区 slug')。
- 写文档：page(action='create', workspace_slug='目标工作区 slug', content='Markdown 正文')。
"""
