---
name: standup
description: 生成站会汇总——昨天做了什么、今天计划、风险与阻塞，来自 Plane 中我的工作项与操作记录；可选写入 Plane 页面
argument-hint: [写入页面的项目标识]
disable-model-invocation: true
---

# standup：站会汇总

先遵循 `plane-workflow:plane-conventions` 的工作区规范：调用 `workspace(action="list")` 定位，歧义询问；后续每次调用显式传 `workspace_slug`，跨区分别查询并标来源，写入前核实目标与授权，无权限拒绝该目标且不切区回退。下文示例中的 `<目标 slug>` 必须替换为已定位的工作区 slug。

## 1. 取数据

1. `workitem` 工具 `action="my_summary", workspace_slug="<目标 slug>"`
2. `workitem` 工具 `action="my_items", workspace_slug="<目标 slug>"`，`filters={"state_group__in":"unstarted,started"}`
3. `workitem` 工具 `action="my_items", workspace_slug="<目标 slug>"`，`filters={"and":[{"state_group__in":"completed"},{"updated_at__range":"<昨天>,<今天>"}]}`（日期用 YYYY-MM-DD；周一则从上周五算起）

## 2. 汇总（Markdown）

```
## 站会 YYYY-MM-DD

**昨天完成**
- WEB-12 修复登录页白屏

**今天计划**
- WEB-30 导出报表加筛选（10/20 截止）

**风险 / 阻塞**
- WEB-8 已逾期 3 天：<原因，未知就写“待确认”>
```

- 今天计划最多 5 条，优先进行中和逾期的。
- 风险只写逾期、7 天内到期但未开始、urgent 未开始的工作项。
- 不要编造原因。

## 3. 可选：写入 Plane

参数里给了项目标识，或用户要求时，用 `page` 工具 `action="create", workspace_slug="<目标 slug>"`，标题「站会 YYYY-MM-DD <姓名>」，内容为上面的 Markdown。写入前先确认。
