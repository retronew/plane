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

echo "当前 git 分支 $branch 对应 Plane 工作项 $key。需要了解任务背景时，用 Plane MCP 的 workitem 工具 action=\"get\" work_item=\"$key\" 读取；提交时可运行 /plane-workflow:issue-ship。"
