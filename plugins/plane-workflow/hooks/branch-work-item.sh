#!/bin/sh
# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.
#
# SessionStart hook: when the current git branch names a Plane work item
# (e.g. fix/WEB-12-safari-login), tell Claude which one this session is about.

branch=$(git branch --show-current 2>/dev/null) || exit 0
key=$(printf '%s' "$branch" | grep -oE '[A-Za-z][A-Za-z0-9]*-[0-9]+' | head -n 1 | tr '[:lower:]' '[:upper:]')
[ -n "$key" ] || exit 0

echo "当前 git 分支 $branch 对应 Plane 工作项 $key。分支编号不能确定工作区。需要了解任务背景时，先调用 Plane MCP 的 workspace(action=\"list\")，按用户指定的名称、slug 或链接定位工作区；有歧义先询问，不使用 X-Workspace-Slug 或历史工作区回退。再用 workitem 工具 action=\"get\" workspace_slug=\"<已定位的目标 slug>\" work_item=\"$key\" 读取，每次调用仍校验成员资格与项目权限，无权限停止该目标操作；提交时可运行 /plane-workflow:issue-ship。"
