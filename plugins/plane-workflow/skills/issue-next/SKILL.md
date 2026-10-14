---
name: issue-next
description: 我接下来该做什么——列出分配给我、未完成的 Plane 工作项，按逾期、优先级、截止日期排序，并提议开始第一个。用户问“今天做什么”“我的待办”“下一个任务”时使用
---

# issue-next：下一个该做的

只读。给出一个五秒钟就能做的决定，不做规划（规划用 `issue-plan-cycle`）。

## 1. 取数据

1. Plane MCP `workitem` 工具：`action="my_summary"`。
2. `workitem` 工具：`action="my_items"`，`filters={"state_group__in":"unstarted,started"}`，`per_page=50`。

## 2. 排序

按以下顺序排，取前 5 个：

1. 已逾期（`target_date` 早于今天）的在最前，逾期越久越靠前
2. 进行中（`started`）先于未开始（`unstarted`）
3. 优先级 urgent > high > medium > low > none
4. 截止日期近的在前，没有截止日期的在后

## 3. 展示

先一行汇总：「分配给你 N 个，逾期 X 个，7 天内到期 Y 个」。然后：

```
WEB-12  High · 逾期 2 天    修复登录页白屏          [进行中]
        理由：逾期且优先级高
WEB-30  Medium · 10/20 截止  导出报表加筛选          [待开始]
        理由：本周到期
```

“理由”一句话，每条不要重复同一句话。

## 4. 提议开工

问：「开始 <第一个编号>？[Y/n/其他编号]」。回答 Y 或回车，执行 `/plane-workflow:issue-start <编号>`；给了其他编号就开始那个；回答 n 就结束。
