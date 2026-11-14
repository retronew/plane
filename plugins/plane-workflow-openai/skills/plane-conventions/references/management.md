# 提醒、审计、成员工作与原因评审

先用 `workspace(action="list")` 定位工作区。下列 `<目标 slug>` 必须替换为实际 slug；所有调用按当前工具 schema 执行。旧服务端没有对应动作时，说明版本限制，不宣称已经执行。

## 提醒配置与审计

1. `project(action="reminder_settings", workspace_slug="<目标 slug>", project="WEB")` 读取现状。
2. 展示具体变更并获得明确授权；已有授权在原范围内沿用。
3. `project(action="update_reminder_settings", workspace_slug="<目标 slug>", project="WEB", remind_in=3, remind_email_enabled=true, remind_feishu_enabled=false, timezone="Asia/Shanghai")` 保存。`remind_in` 为 0–7，0 关闭提醒；未传字段保持原值。
4. 再读配置核验，并用 `project(action="activities", workspace_slug="<目标 slug>", project="WEB", per_page=50)` 查看配置变更记录。返回 `next_cursor` 时继续分页。

仅管理员可修改。渠道启用、提前天数和项目时区共同决定提醒行为；配置成功不代表投递成功。项目配置审计不是工作项活动，也不是全局提醒扫描日志。投递异常仍需管理员排查运行环境。

## 团队成员工作

- 汇总：`workspace(action="member_work", workspace_slug="<目标 slug>", projects=["WEB"], start_date="2026-11-01", end_date="2026-11-30")`。
- 明细：`workspace(action="member_work_items", workspace_slug="<目标 slug>", projects=["WEB"], member="me", status="overdue", page=1, page_size=20)`。

项目筛选可省略，只统计当前有权限的项目。日期须同时提供，范围包含两端，以工作项的 `target_date` 为依据，不能当作完成时间或活动发生时间范围。统计按当前负责人及各项目时区计算；多人负责的同一工作项会分别计入各成员，不能简单相加当作团队独立工作项总数。

明细 `status` 支持 `all`、`overdue`、`late_completed`、`justified`、`unjustified`、`unreviewed`。按响应 `next_page` 继续传 `page`，直到 `next_page=null`，不使用 cursor。任何页失败或预算不足，注明覆盖范围。评审状态筛选本身不限定逾期；必须结合工作项状态和截止日期解释。

## 评论原因评审

1. `workitem(action="comments", workspace_slug="<目标 slug>", work_item="WEB-12")` 读取评论，按 cursor 分页。
2. `workitem(action="comment_reviews", workspace_slug="<目标 slug>", work_item="WEB-12")` 读取当前有效状态、`is_stale`、历史和 `can_review`。
3. 核对具体评论、证据及用户授权后，`workitem(action="review_comment", workspace_slug="<目标 slug>", work_item="WEB-12", comment_id="<评论 ID>", review_status="justified")`。状态还支持 `unjustified` 和 `unreviewed`。
4. 再读评审核验。请求失败不重复提交；先读历史判断是否已写入。

仅管理员可写，禁止评审自己的评论。评论编辑后评审失效，应展示为未评审并保留历史；重新评审追加记录，不覆盖历史。不要从逾期天数自动推断原因合理性，也不要把 `unreviewed` 当作 `unjustified`。

## 当前状态停留时长

`workitem(action="list", workspace_slug="<目标 slug>", project="WEB", filters={"and":[{"state_group":"started"},{"state_duration__gt":3}]})` 查找当前进行中超过三天的工作项。`my_items` 也支持相同 filters。

`state_duration__gt` 与 `state_duration__lt` 以连续自然天计，支持小数且为严格比较。切换状态后重新计时；旧记录没有状态进入时间时回退到 `created_at`。该指标不能当作实际工时或历史累计耗时。
