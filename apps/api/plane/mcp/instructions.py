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
- 新 OAuth 授权可访问该账号当前有权限的工作区；旧版单工作区授权仍受原工作区限制。
- 只读授权不能写入；需要写入时请用户重新连接并明确授权读写，授权不会提升原有项目权限。
- 个人 API Key 可跨已加入的工作区；工作区 API Key 仍仅能访问其授权工作区。
- 不确定对象在哪时，先用 workspace(action='search', workspace_slug='目标工作区 slug')。
- 状态、标签、负责人可以直接传名称；负责人可以传 me、邮箱或显示名。
- 正文、评论、页面内容都用 Markdown。
- 正文和评论里的图片写作 ![图片](asset:资产ID)。要看图片内容，用
  workitem(action='images', workspace_slug='目标工作区 slug', work_item='WEB-12')，
  它按顺序返回描述、评论和附件里的图片，每次最多 5 张，可用 images 参数指定序号或资产 ID。
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
- 团队负载：workspace(action='member_work', workspace_slug='目标工作区 slug') 汇总，
  workspace(action='member_work_items', workspace_slug='目标工作区 slug', member='me') 下钻；
  明细用 next_page 作为 page 翻页。
  日期范围按截止日期筛选，按当前负责人及各项目时区统计，多负责人分别计数。
- 提醒配置：project(action='reminder_settings', workspace_slug='目标工作区 slug', project='WEB') 读取，
  update_reminder_settings 保存提前天数、渠道与时区，activities 查看项目配置审计；配置开启不代表投递成功。
- 原因评审：先 workitem(action='comment_reviews', workspace_slug='目标工作区 slug', work_item='WEB-12') 查看历史，
  获得授权后用 review_comment 提交；仅管理员、禁止自审，评论编辑后旧评审失效，未评审不等于不合理。
- 批量导入：先分别读完 list 和 archived；用 external_source/external_id 调用 upsert 或 bulk_upsert。
  逐项保存 UUID 与结果，unknown 先用 get_by_external_id 核验；归档 UUID 可 get(include_archived=true)。
- 原生依赖：relations 读取，add_relation/remove_relation 幂等修改；A blocks B 表示 A 阻塞 B。
- 模块归属：module 创建/更新支持 lead 与 members；省略保留，lead=null、members=[] 分别清空。
- 停滞排查：工作项 filters 支持 state_duration__gt / state_duration__lt，
  单位为当前状态连续自然天，支持小数，非实际工时。
"""
