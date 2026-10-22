# MCP 插件上线与验收

正式 Claude 与 OpenAI 插件从 0.3.3 起均内置 `https://plane.mdropwork.com/mcp`，默认通过 OAuth 连接。插件仓库由本仓库 `preview` 分支的 Sync plugin marketplaces 工作流生成；推送源码不等于部署 Plane 服务。

## 上线准备

1. 按 [开发指南](development.md) 构建 API、执行数据库迁移（包括 `0154_mcp_oauth_account_scope`），再更新 API、web 和代理。不要重跑 `setup.sh` 覆盖已有环境。
2. 后端运行环境设置以下值，重新创建 API 容器使其生效：

   ```dotenv
   MCP_OAUTH_ISSUER=https://plane.mdropwork.com
   MCP_OAUTH_GRANT_DAYS=180
   WEB_URL=https://plane.mdropwork.com
   APP_BASE_URL=https://plane.mdropwork.com
   ```

3. 代理将 `/.well-known/oauth-protected-resource`、`/.well-known/oauth-protected-resource/mcp`、`/.well-known/oauth-authorization-server`、`/auth/mcp/*`、`/mcp` 转发到 API；`/mcp-connect` 留给 web。使用有效 HTTPS 证书，并保留前端安全响应头。
4. 执行发现端点检查，确认 issuer、resource、授权及令牌地址均匹配线上入口：

   ```sh
   node --input-type=module -e 'import { checkDesktopEndpoint } from "./plugins/plane-workflow/portable/claude-desktop.mjs"; await checkDesktopEndpoint("https://plane.mdropwork.com"); console.log("OAuth discovery OK");'
   ```

该检查只验证发现配置；完整登录、SSO 回跳和客户端重连仍需按下面步骤验收。

## 客户端验收

1. 更新 `retronew/plane-plugins` 市场中的 Plane 插件到 **0.3.3 或更高版本**。若之前上传过本地测试 ZIP，先移除或替换该测试包，避免它覆盖市场版本。也可从部署后的 Plane 下载 [Claude ZIP](https://plane.mdropwork.com/skills/plane-workflow-claude.zip) 或 [OpenAI ZIP](https://plane.mdropwork.com/skills/plane-workflow-openai.zip)，通过客户端支持的插件安装入口安装。
2. **Claude Desktop Code 模式**：新建本机 Code 会话，确认已加载插件；在 Connectors → Manage connectors 中等待 `plane` 出现，再点击 Connect。必要时先发送“只回复 OK，不调用工具、不修改文件”初始化会话。旧会话可能缓存测试地址；安装本身不会自动打开授权页。Chat / Cowork 的远程连接需要云端能够访问的 HTTPS 地址。
3. **ChatGPT / Codex**：从插件连接入口发起 OAuth；若旧聊天仍缓存测试连接，使用新聊天。各客户端版本的连接入口可能不同。
4. 登录 Plane，在授权页核对账号、客户端和 **180 天**，首次选择只读授权。不需要选择工作区；新授权可访问该账号当前有权限的工作区。
5. 发送：“检查 Plane 连接，只读列出我可访问的工作区，不修改数据。”然后明确指定一个 `workspace_slug` 查询工作项，确认身份、工作区和只读工具调用正常。需要测试写入时，另外授权读写，并只在专用测试工作区创建、修改和删除标记为 `【演示】OAuth 测试` 的工作项。
6. 分别连接 Claude 与 OpenAI，确认 Plane「个人菜单 → 开发者 → 授权连接」中可独立管理连接。只撤销其中一条，再调用该客户端工具：应要求重新认证，另一条连接应继续可用。
7. 回到被撤销的客户端重新 Connect / 登录授权，再次只读查询。若没有重连按钮，先新建聊天触发认证；本地 Codex 可先用 `codex mcp list` 确认服务名，再用 `codex mcp login <服务名>` 发起 OAuth。Plane 的“重新授权”会撤销所选连接并提示返回客户端，无法代替客户端发起 PKCE 登录。

默认总授权期为 180 天；访问令牌最长一小时，由客户端自动刷新，刷新不会延长总授权。修改有效期只影响新授权，已有连接保持原到期时间。到期和撤销一样需要重新授权：MCP 返回 401，刷新返回 `invalid_grant`。不要为测试过期而修改线上系统时钟或全局有效期；使用隔离测试环境或既有自动化测试。

## 用个人 API Token 手动连接

MCP 是工具协议，OAuth 与个人 API Token 是两种认证方式。服务端保留 API Token 接入；Token 使用自己的有效期和撤销规则，不受 OAuth 的 180 天控制。不要同时启用名称含糊的插件连接与手动连接，以免测试时调用错连接。

**Claude Code / 支持手动 MCP 配置的本机客户端**可配置：

```json
{
  "mcpServers": {
    "plane-token": {
      "type": "http",
      "url": "https://plane.mdropwork.com/mcp",
      "headers": { "Authorization": "Bearer ${PLANE_API_TOKEN}" }
    }
  }
}
```

**Codex / 支持本地 MCP 配置的 Work 环境**可配置：

```toml
[mcp_servers.plane_token]
url = "https://plane.mdropwork.com/mcp"
bearer_token_env_var = "PLANE_API_TOKEN"
```

将个人令牌保存在私有环境变量中，并确保客户端进程实际继承该变量；从桌面启动的客户端不一定继承终端环境。不要将真实令牌放进聊天、插件包、Git 或公开配置。手动 Token 连接不需要 OAuth 授权，但仍按令牌所属账号的权限执行操作。

**ChatGPT 云端插件连接**不能套用上述本地配置来传入任意个人 API Key，应使用 OAuth。Claude 的本机 Code、远程连接器及 ChatGPT/Codex 的本地或云端连接是不同入口，不能仅按产品名称推断支持范围。

参考：[Claude Code MCP 配置](https://code.claude.com/docs/en/mcp)、[OpenAI 本地 MCP 配置](https://learn.chatgpt.com/docs/extend/mcp)、[OpenAI 插件认证](https://developers.openai.com/plugins/build/auth)。
