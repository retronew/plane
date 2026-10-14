---
name: issue-start
description: 开始做一个 Plane 工作项——读取详情、改为进行中、分配给自己，并按团队规范创建 git 分支
argument-hint: <工作项编号，如 WEB-12>
disable-model-invocation: true
---

# issue-start：开工

参数：`$ARGUMENTS`（工作项编号）。没给编号就先运行 `/plane-workflow:issue-next` 让用户选。

## 1. 读取

Plane MCP `workitem` 工具 `action="get"`，`work_item="<编号>"`。展示标题、状态、优先级、负责人、描述要点（最多 8 行）。

- 状态组已是 `completed` / `cancelled`：提醒用户并确认是否仍要继续。
- 负责人是别人：提醒「当前负责人是 X」，确认后再改。

## 2. 更新 Plane

先用 `project` 工具 `action="states"` 找到该项目 `started` 状态组里的第一个状态，然后调用 `workitem` 工具 `action="update"`：

- `state`：该状态名
- `assignees`：原负责人加上 `me`（不要移除原负责人，除非用户要求）

## 3. 创建分支

1. `git status --porcelain` 有未提交改动时，先问用户是暂存（stash）还是继续。
2. 分支名：`<type>/<编号>-<描述>`。type 按工作项内容判断（缺陷 fix，新功能 feat，其他 chore），描述取标题的英文概括，小写，用连字符，不超过 40 个字符。
3. `git switch -c <分支名>`；分支已存在就 `git switch <分支名>`。

## 4. 汇报

「已开始 WEB-12：<标题>，状态改为 <状态>，分支 <分支名>」，并列出描述里的待办条目，作为接下来的工作清单。
