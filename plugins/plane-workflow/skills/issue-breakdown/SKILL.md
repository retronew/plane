---
name: issue-breakdown
description: 把一段需求、一个 Plane 页面或一个大工作项拆成父子工作项。先列出拆分方案给用户确认，再在 Plane 中创建。用户说“拆一下”“建任务”“把这个需求落到 Plane”时使用
---

# issue-breakdown：拆需求

先遵循 `plane-workflow:plane-conventions` 的工作区规范：调用 `workspace(action="list")` 定位，歧义询问；后续每次调用显式传 `workspace_slug`，跨区分别查询并标来源，写入前核实目标与授权，无权限拒绝该目标且不切区回退。下文示例中的 `<目标 slug>` 必须替换为已定位的工作区 slug。

## 1. 输入

需求可能来自：

- 用户直接给的文字
- Plane 页面：`page` 工具 `action="get", workspace_slug="<目标 slug>"`
- 已有工作项：`workitem` 工具 `action="get", workspace_slug="<目标 slug>"`（拆成它的子工作项）

确定目标项目；不明确就问。用 `project` 工具 `action="labels", workspace_slug="<目标 slug>"` 和 `action="states", workspace_slug="<目标 slug>"` 了解可用的标签和状态。

## 2. 拆分方案（先不创建）

按 `plane-conventions` 的规范拟定：

- 一个父工作项（输入已是工作项时就用它）
- 3–10 个子工作项，每个半天到三天的工作量，能独立验收；每个写标题、一句话描述、建议优先级、建议标签

用表格展示，问：「按这个创建？可以增删改」。

## 3. 创建

确认后：

1. 需要时创建父工作项：`workitem` 工具 `action="create", workspace_slug="<目标 slug>"`，描述里写完整背景与验收标准。
2. 逐个创建子工作项，传 `parent=<父编号>`。
3. 如果用户要求，把它们加入周期（`cycle` 工具 `action="add_items", workspace_slug="<目标 slug>"`）或模块。

任何一步失败就停下，报告已创建的部分，不要重试到底。

## 4. 汇报

列出创建的编号与标题，以及父工作项编号。
