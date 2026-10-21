---
name: issue-plan-cycle
description: 迭代规划——从 Plane 待办中挑选候选工作项，经用户确认后加入当前或指定周期
---

# issue-plan-cycle：给周期排活

## 执行边界

先遵循 Plane 团队规范。没有可用 Plane MCP 时只草拟，不宣称读取或写入成功。调用参数以当前工具 schema 为准。

先调用 `workspace(action="list")` 定位目标；歧义时询问。除该发现调用外，每次读取、分页、写入及核验都显式传 `workspace_slug`，同时携带目标项目和对象标识。跨工作区分别查询、分别分页并标明 slug 与项目来源；不得使用历史默认工作区，不得在无权限时切换工作区重试同名对象。

列表按返回的 cursor、next_page 或 has_more 连续分页，直到结束；如果达到客户端预算、权限受限或某页失败，明确标注仅覆盖已读取范围，不把部分数据当作全量排名、计数或规划依据。不要猜测分页参数。

写入前展示具体目标与变更，获得用户明确确认；已有明确授权仅在原范围内沿用。沉默、空消息或回车不算确认。任何步骤失败立即停止依赖它的后续操作，报告已成功、失败和未执行部分；结果不明时先读取核验，避免重复创建。写后读取核验，只报告已证实的结果。

从用户请求获取项目标识和可选周期名称。没给项目就用 `project` 工具 `action="list", workspace_slug="<目标 slug>"` 让用户选。

## 1. 确定周期

`cycle` 工具 `action="list", workspace_slug="<目标 slug>"`。没指定周期时，选当前日期落在 start_date 与 end_date 之间的周期；没有则选最近一个未开始的周期。都没有就问用户是否新建（`cycle` 工具 `action="create", workspace_slug="<目标 slug>"`，需要名称、开始和结束日期）。

## 2. 当前负载

`cycle` 工具 `action="get", workspace_slug="<目标 slug>"` 看已有工作项数量与完成情况，`action="items", workspace_slug="<目标 slug>"` 列出已在周期里的工作项。

## 3. 候选

`workitem` 工具 `action="list", workspace_slug="<目标 slug>"`，项目内、`filters={"state_group__in":"backlog,unstarted"}`，按 `priority` 排序，取前 30 个，排除已在该周期的。

按优先级分组展示，每行：编号、优先级、标题、负责人（没有写“未分配”）、截止日期。

## 4. 确认后加入

请用户给出要加入的编号（或「全部 high 以上」这样的描述，先展开成具体编号再确认）。确认后调用 `cycle` 工具 `action="add_items", workspace_slug="<目标 slug>"`，`work_items` 传编号列表。

## 5. 汇报

「已向 <周期名> 加入 N 个工作项，周期内现有 M 个」，并提醒仍未分配负责人的工作项。
