---
name: plane-setup
description: 配置并检查 Plane 连接——引导创建个人 API Key、填写插件配置，并调用 Plane MCP 自检。用户第一次使用、或 Plane 工具报“API Key 无效/未连接”时使用
disable-model-invocation: true
---

# plane-setup：连接 Plane

## 1. 自检

调用 Plane MCP 的 `workspace` 工具：`action="me"`。

- 成功：报告「已连接：<display_name>（<email>），工作区 <workspace>」，再调用 `project` 工具 `action="list"`，列出可用项目的标识和名称（最多 10 个）。结束。
- 没有 Plane 工具，或返回 401 / “API Key 无效或已过期”：进入第 2 步。
- 返回“你不是工作区 X 的成员”：工作区 slug 填错了，进入第 2 步的第 3 条。

## 2. 引导配置

按顺序告诉用户（每次只给需要的那一步）：

1. **创建 Key**：打开 Plane →「个人设置 → API 令牌」→ 创建令牌。只想让 AI 查询时，打开“只读”。创建后的弹窗里可以一键复制 MCP 配置，但用本插件只需要复制 Key 本身。
2. **填写插件配置**：运行 `/plugin`，找到 plane-workflow → 配置，填写：
   - Plane 地址：如 `https://plane.example.com`（不带 `/mcp`）
   - API Key：上一步复制的 Key（会存入系统钥匙串，不会写进配置文件）
   - 工作区 slug：网址里工作区那一段，留空则用最近访问的工作区
3. 改完配置后运行 `/mcp` 重新连接 plane，再运行一次 `/plane-workflow:plane-setup` 自检。

不要让用户把 Key 粘贴到对话里；如果用户已经粘贴，提醒他稍后在 Plane 里删除这个 Key 并重新创建一个。
