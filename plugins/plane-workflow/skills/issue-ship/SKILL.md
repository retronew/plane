---
name: issue-ship
description: 提交当前工作——从分支名找到 Plane 工作项，推送并创建 PR，在工作项下评论 PR 链接，状态改为评审中
disable-model-invocation: true
---

# issue-ship：提交 PR 并更新 Plane

先遵循 `plane-workflow:plane-conventions` 的工作区规范：调用 `workspace(action="list")` 定位，歧义询问；后续每次调用显式传 `workspace_slug`，跨区分别查询并标来源，写入前核实目标与授权，无权限拒绝该目标且不切区回退。下文示例中的 `<目标 slug>` 必须替换为已定位的工作区 slug。

## 1. 找到工作项

从 `git branch --show-current` 中匹配 `[A-Z0-9]+-[0-9]+`（如 `fix/WEB-12-safari-login` → `WEB-12`）。匹配不到就问用户编号。用 Plane MCP `workitem` 工具 `action="get", workspace_slug="<目标 slug>"` 读取。

## 2. 检查

- `git status`：有未提交改动就先问用户是否提交（不要擅自提交）。
- 对照工作项描述里的待办条目，列出哪些看起来还没完成，询问是否仍要提交。

## 3. 推送并创建 PR

1. `git push -u origin HEAD`
2. 如果项目里有 `create-pull-request` 技能就用它；否则用 `gh pr create`。PR 标题以 `[WEB-12]` 开头，正文第一行写 Plane 工作项链接或编号。
3. 记下 PR 地址。

## 4. 更新 Plane

1. `workitem` 工具 `action="add_comment", workspace_slug="<目标 slug>"`：「已提交 PR：<地址>」，再加两三条改动要点（Markdown 列表）。
2. 用 `project` 工具 `action="states", workspace_slug="<目标 slug>"` 查看状态：有名称含 Review / 评审 的状态就改成它；没有就保持当前状态，**不要**改为完成——合并后才算完成。

## 5. 汇报

「WEB-12 已提交 PR <地址>，Plane 已评论，状态：<状态>」。
