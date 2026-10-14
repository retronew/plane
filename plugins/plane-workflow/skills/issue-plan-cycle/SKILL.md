---
name: issue-plan-cycle
description: 迭代规划——从 Plane 待办中挑选候选工作项，经用户确认后加入当前或指定周期
argument-hint: <项目标识> [周期名称]
disable-model-invocation: true
---

# issue-plan-cycle：给周期排活

参数：`$ARGUMENTS`（项目标识，可选周期名称）。没给项目就用 `project` 工具 `action="list"` 让用户选。

## 1. 确定周期

`cycle` 工具 `action="list"`。没指定周期时，选当前日期落在 start_date 与 end_date 之间的周期；没有则选最近一个未开始的周期。都没有就问用户是否新建（`cycle` 工具 `action="create"`，需要名称、开始和结束日期）。

## 2. 当前负载

`cycle` 工具 `action="get"` 看已有工作项数量与完成情况，`action="items"` 列出已在周期里的工作项。

## 3. 候选

`workitem` 工具 `action="list"`，项目内、`filters={"state_group__in":"backlog,unstarted"}`，按 `priority` 排序，取前 30 个，排除已在该周期的。

按优先级分组展示，每行：编号、优先级、标题、负责人（没有写“未分配”）、截止日期。

## 4. 确认后加入

请用户给出要加入的编号（或「全部 high 以上」这样的描述，先展开成具体编号再确认）。确认后调用 `cycle` 工具 `action="add_items"`，`work_items` 传编号列表。

## 5. 汇报

「已向 <周期名> 加入 N 个工作项，周期内现有 M 个」，并提醒仍未分配负责人的工作项。
