---
name: issue-plan-cycle
description: 迭代规划——从 Plane 待办中挑选候选工作项，经用户确认后加入当前或指定周期
argument-hint: <项目标识> [周期名称]
disable-model-invocation: true
---

# issue-plan-cycle：给周期排活

先遵循 `plane-workflow:plane-conventions` 的工作区规范：调用 `workspace(action="list")` 定位，歧义询问；后续每次调用显式传 `workspace_slug`，跨区分别查询并标来源，写入前核实目标与授权，无权限拒绝该目标且不切区回退。下文示例中的 `<目标 slug>` 必须替换为已定位的工作区 slug。

参数：`$ARGUMENTS`（项目标识，可选周期名称）。没给项目就用 `project` 工具 `action="list", workspace_slug="<目标 slug>"` 让用户选。

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
