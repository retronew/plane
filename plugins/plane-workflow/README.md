# Plane Workflow

八项完整技能使用同一份业务正文：唯一编辑源为 `plugins/plane-workflow/skills/<skill>/SKILL.md`。Claude marketplace、Claude 上传插件、OpenAI 插件和通用下载共享全部八项流程。安装技能、注册 marketplace、安装插件、连接 MCP 是独立状态；只有只读自检成功才能报告已连接。

| 技能              | 完整流程                                            |
| ----------------- | --------------------------------------------------- |
| plane-setup       | OAuth 连接或 API Token、检查身份与工作区            |
| plane-conventions | 团队规范、权限、分页、明确确认和失败处理            |
| issue-next        | 全量范围内排序待办，明确选择后衔接开工              |
| issue-start       | 读取、授权更新状态与负责人、检查仓库并建分支        |
| issue-ship        | 检查、授权推送、创建 PR、评论真实链接、更新评审状态 |
| issue-breakdown   | 草拟父子工作项、确认方案、逐项创建和核验            |
| issue-plan-cycle  | 周期负载、候选分页、确认具体编号后加入              |
| standup           | 完成时间证据、今日计划、风险、确认后可写页面        |

正文只使用 name/description frontmatter，不依赖客户端专属工具名。当前无需客户端字段适配；以后需要时由生成器适配，不能分别维护业务正文。互引使用自然语言，单项正文包含必要的执行边界。

## 安装

Claude Code 从仓库安装 marketplace，再安装插件：

```bash
claude plugin marketplace add retronew/plane-plugins
claude plugin install plane-workflow@plane-ai
```

插件市场发布在独立的分发仓库 [retronew/plane-plugins](https://github.com/retronew/plane-plugins)，客户端只需拉取约 0.1 MB；它由 `.github/workflows/sync-plugins.yml` 在 `preview` 更新后通过 `portable/export.mjs` 自动同步，请勿直接修改分发仓库。Claude Desktop 使用当前客户端实际提供的 marketplace 或插件上传入口。普通聊天附件不代表持久安装。上传插件使用 `/skills/plane-workflow-claude.zip`；其根目录包含 `.claude-plugin/plugin.json`、`agents/`、`hooks/` 和 `skills/<八项技能>/`，没有外层目录，`.sh` 脚本在包内保留可执行权限。上传包和 marketplace 插件内容完全一致。

`hooks/` 和 `agents/` 是 Claude 专属组件，仅供支持这些能力的 Claude 客户端使用；OpenAI 插件和通用 ZIP 不包含它们。OpenAI 插件的 `.codex-plugin/plugin.json` 由 `portable/build.mjs` 从 `.claude-plugin/plugin.json` 生成，请勿手工编辑。没有相关能力时不能承诺自动识别分支或运行代理。

支持插件命令的 Codex CLI 可注册并安装 OpenAI catalog：

```bash
codex plugin marketplace add retronew/plane-plugins
codex plugin add plane-workflow@plane-openai
```

先用当前 CLI 的 `--help` 确认命令支持情况，再用 `codex plugin marketplace list`、`codex plugin list --marketplace plane-openai` 核对注册和安装状态。也可从仓库根目录运行 `codex plugin marketplace add .`。OpenAI 独立包为 `plugins/plane-workflow-openai`，内含八个完整 skill 目录；不含 hooks 或 agent；包含绑定实例地址的 OAuth MCP 配置。

ChatGPT 是否支持 marketplace 或自定义技能导入，由具体客户端、账户和工作区策略决定。由用户自己完成客户端安装与连接操作，不代点 ChatGPT 按钮，也不声称 CLI 注册已经完成 ChatGPT 安装。

支持 skills CLI 的客户端可发现并安装 canonical 八项技能：

```bash
npx skills add https://github.com/retronew/plane-plugins/tree/main/plugins/plane-workflow/skills --list
npx skills add https://github.com/retronew/plane-plugins/tree/main/plugins/plane-workflow/skills
```

`--list` 只发现；在交互安装器选择技能、客户端和范围。分发仓库同步完成后才能安装到新版本。安装后用 `npx skills list` 检查，再按客户端要求重新加载。覆盖已有自定义技能前先比较并确认，不默认添加跳过确认的选项。

通用 `/skills/plane-workflow.zip` 含八个顶层 skill 目录，供解压后安装到客户端的技能目录（例如 `~/.agents/skills/`），完整保留每项的资源子目录。这是多技能分发包，不能保证 ChatGPT 的单技能上传入口接受八目录 ZIP。只有客户端明确提供相应导入能力时才能使用。缺少安装能力时可阅读 Markdown 作为会话参考，不能报告持久安装成功。

## 手动连接 MCP

OpenAI 0.3.2 插件提供 OAuth 连接；Claude 与通用技能包继续支持手动连接。由用户在 Plane「个人设置 → API 令牌」创建令牌，然后在客户端手动配置：

- Streamable HTTP URL：`https://plane.example.com/mcp`
- 请求头：`Authorization: Bearer <Plane API token>`，或客户端支持的安全环境变量引用。

不要把真实令牌写进聊天、技能、ZIP、共享配置或提交中。仅查询可以使用只读令牌。客户端不能发送所需请求头时，报告该入口限制，不把 Plane token 当作 OAuth 凭据。

Claude Code 可由用户执行以下占位示例，真实令牌只在其本地安全配置中处理：

```bash
claude mcp add --transport http plane https://plane.example.com/mcp --header "Authorization: Bearer <Plane API token>"
```

Codex 可在其现有配置中合并以下手动 server 条目，由用户确保启动客户端的环境包含 `PLANE_API_TOKEN`，然后重连。不要覆盖其他配置；另一终端的环境变量不会自动更新已运行桌面进程。

```toml
[mcp_servers.plane]
url = "https://plane.example.com/mcp"
bearer_token_env_var = "PLANE_API_TOKEN"
```

连接后调用 `workspace(action="list")`，按名称、slug 或链接定位目标，再调用 `workspace(action="me", workspace_slug="<目标 slug>")` 核验身份。除 list 发现调用外，每次读取、分页、写入及核验都显式传 `workspace_slug`。跨工作区分别查询并标明来源；无权限时停止该目标，不能切区重试同名对象。个人 token 可访问本人有权限的多个工作区，workspace-scoped token 仅限其绑定工作区。

未连接时只能草拟内容。有 MCP 也不代表有 shell/Git 或 PR 工具；缺少这些能力时，开工与提交流程应报告已完成的 Plane 部分和未执行步骤，不能假装创建分支、推送或 PR。

## 构建与前端对接

```bash
pnpm --filter web build:skills
```

该命令生成并执行分发测试。现有 web build、preview 和 Docker 构建继续使用此入口；无需额外依赖，要求 Node.js 22 或更新版本。

| 用途                  | 路径                                            |
| --------------------- | ----------------------------------------------- |
| 主安装源              | `plugins/plane-workflow/skills`                 |
| OpenAI 八技能生成目录 | `plugins/plane-workflow-openai/skills/<skill>/` |
| 每项公开 Markdown     | `/skills/<skill>/SKILL.md`                      |
| 通用八目录 ZIP        | `/skills/plane-workflow.zip`                    |
| Claude 插件 ZIP       | `/skills/plane-workflow-claude.zip`             |
| 完整聚合兼容下载      | `/skills/plane-workflow/SKILL.md`               |

`portable/plane-workflow/SKILL.md` 和公开聚合索引都由生成器输出，含八项完整正文，仅保留兼容下载，不作为主安装源。生成器先清理自己管理的公开 skills 目录、OpenAI skills 目录和 portable 聚合目录，再全量生成；这些目录不要放手工维护文件。canonical 每个 skill 的 `scripts/`、`references/`、`assets/` 及其他资源文件递归保留，忽略 `.DS_Store`，拒绝符号链接等特殊源条目。ZIP 使用固定时间戳、稳定顺序和无压缩条目，可逐字节复现。

测试核对八项语义边界、完整目录和两类 ZIP 的字节一致性、CRC 与中央目录、OAuth 连接配置、无真实秘密、版本一致及重新构建可复现。生成后一起分发源、生成目录、公开 Markdown 和 ZIP。测试直接检查生成产物，失败会中止现有 web 构建。

## OAuth 部署与实例绑定（0.3.2）

OpenAI marketplace 的 `policy.authentication` 为 `ON_INSTALL`。插件的 `.codex-plugin/plugin.json` 引用根目录 `.mcp.json`，声明 HTTP MCP，由服务端发现文档提供 OAuth/DCR，用户安装后连接、登录 Plane 并授权账号范围。默认只读，可显式勾选读写；授权不提升用户原本的项目权限。安装入口和提示文案取决于桌面客户端版本，本仓库不能控制客户端 UI。

新授权不要求选择工作区；账号范围包含以后加入的工作区，但每次请求仍校验成员资格与项目权限。已有单工作区授权和升级前已签发的确认票据保留原限制，不能自动扩大。多个客户端可以同时连接，撤销或重新授权仅针对所选的一条连接。重新授权须回到客户端启动新的 PKCE 流程。

授权页使用前端 `/mcp-connect` 与会话保护的 `/auth/mcp/consent/`，请同时部署前后端，并保留前端的防嵌入安全响应头。客户端 `127.0.0.1/callback` 完成页由客户端提供，不属于 Plane 的多语言或样式范围。

当前桌面兼容包不同时提供根目录 `plugin.json`：实测内置 CLI `0.163.0-alpha.11.1` 会优先读取它、忽略兼容清单，导致 `plugin/read` 返回空的 `mcpServers`。升级后应通过该协议确认返回 `["plane"]`，再验证 OAuth；文件存在或技能出现都不能证明 MCP 已加载。

安装了桌面 CLI 的开发机可运行 `PLANE_TEST_CODEX_BIN=/absolute/path/to/codex node --test --test-concurrency=1 plugins/plane-workflow/portable/*.test.mjs`。这会额外用实际客户端读取临时本地包，断言 MCP、八项技能和版本均被识别；不安装插件、不启动 MCP 或改变客户端配置。普通 CI 仍运行包结构、导出、地址隔离和可复现检查。安装后的 `mcpServerStatus/list` 应能识别 `plane`；未授权时 `authStatus` 为 `notLoggedIn`，完成用户授权后才应验收工具调用。

当前正式包绑定 `https://plane.mdropwork.com/mcp`；公开下载为 `/skills/plane-workflow-openai.zip`。配置源在 `plugins/plane-workflow/instance.json`，修改 URL 后运行 `node plugins/plane-workflow/portable/build.mjs`。不要直接修改生成目录或安装缓存。不同实例要分别构建包，不存在安装时输入任意地址的表单。

上线步骤：

1. 后端运行环境（仓库 Docker Compose 使用 `apps/api/.env`）设置 `MCP_OAUTH_ISSUER=https://plane.mdropwork.com`（不带 `/mcp`）。未设置时回退 `WEB_URL`；`WEB_URL`、`APP_BASE_URL` 配置实际前端登录地址 `https://plane.mdropwork.com`。这是管理员的部署配置，不要求每位安装插件的用户填写；改变环境变量后需重新创建 API 容器使其生效。正式环境使用 HTTPS。
2. 按开发指南先构建 API 镜像、执行数据库迁移 `0154_mcp_oauth_account_scope`，再更新 API 服务；更新 web 以包含登录返回路由 `/mcp-connect`。
3. 更新代理：`/.well-known/oauth-protected-resource`、`/.well-known/oauth-protected-resource/mcp`、`/.well-known/oauth-authorization-server`、`/auth/mcp/*` 和 `/mcp` 必须到 API。本仓库两份 Caddy 配置已包含转发；外部反向代理也必须配置。
4. 部署后读取发现文档，确认 issuer、resource 和所有 endpoint 都是线上域名，再发布/更新插件。仅更新插件不会部署 OAuth 后端。本次不自动推送或部署。
5. 安装新版本后连接。授权管理位于个人设置 → 开发者 → 授权连接，与 API Token 入口一起管理，不另开页面。撤销会使整个授权族失效。

OAuth 采用 public client + 动态注册（DCR）+ Authorization Code + PKCE S256，不要求用户填写 client secret。客户端回调仅接受 HTTPS 或 IP loopback HTTP，严格绑定注册的完整回调地址。授权码两分钟有效、一次性使用；访问令牌一小时、授权/刷新最多三十天；刷新令牌轮换，旧刷新令牌重用撤销授权族。令牌和授权码仅存 SHA-256 摘要，OAuth 令牌只用于 MCP，不作为通用 API Key 使用。成员资格、账户状态、工作区和读写权限在请求时复核。

本地验证使用独立测试包，运行 `node plugins/plane-workflow/portable/local-package.mjs /absolute/output-directory http://localhost:8000`；它不会修改正式包的实例地址。测试实例的 `MCP_OAUTH_ISSUER` 必须匹配这个本地地址。后端测试使用 `docker compose -p plane-test -f docker-compose-test.yml` 隔离栈。

协议依据：[OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth)、[plugin packaging](https://developers.openai.com/plugins/build/plugins)。

## 渠道覆盖与本地试装

| 渠道                        | 打包的 MCP 能力                                 | 本地测试方式                                            |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| ChatGPT / Codex OpenAI 插件 | 根目录 `.mcp.json`，实例固定地址 + OAuth        | 用 `local-package.mjs` 生成独立本地市场，安装后连接授权 |
| Claude Code / Claude 插件包 | 当前只有技能、agents 和 hooks，没有 `.mcp.json` | 单独添加 HTTP MCP，可走 OAuth 或原 API Token            |
| 通用 skills ZIP             | 仅技能，不包含 MCP                              | 在宿主独立设置 MCP                                      |

同步由 `.github/workflows/sync-plugins.yml` 在远端 `preview` 的相关路径更新后触发（或人工 workflow_dispatch）。仅本地 commit 不触发；同步需要 `PLANE_PLUGINS_DEPLOY_KEY`。导出会包含 `plugins/plane-workflow-openai/.mcp.json`，但不部署 Plane 服务端。

本地后端启动并应用迁移后，检查 `http://localhost:8000/.well-known/oauth-authorization-server` 的 issuer 为 `http://localhost:8000`，前端登录入口为 `http://localhost:3000`。生成测试包：

```bash
node plugins/plane-workflow/portable/local-package.mjs /absolute/new-test-marketplace http://localhost:8000
codex plugin marketplace add /absolute/new-test-marketplace
codex plugin add plane-workflow@plane-local-test
```

在同一 host 的客户端重新加载插件，点击连接并亲自登录、确认账号范围。客户端不显示连接入口时先检查插件详情是否加载 MCP；不能仅凭技能出现就认定已连接。本地市场与正式 `plane-openai` 市场分开，不修改正式包或已有连接。

Claude Code 单独测试服务端 OAuth：

```bash
claude mcp add --transport http --scope local plane-oauth-local http://localhost:8000/mcp
```

启动 Claude Code 后通过 `/mcp` 选择 `plane-oauth-local` 并认证。该方式验证服务端 OAuth，不代表 Claude 插件已打包 MCP。客户端若从云端访问远程 MCP，无法访问你电脑的 localhost；此时需使用可达的 HTTPS 测试地址并重新生成对应实例的包，不能把本地地址当成公网地址。

验收顺序：首次只读授权 → 初始化与工具列表 → `workspace(action="list")` 显示当前有权限的工作区 → 无权限工作区请求失败 → 在个人设置的开发者 MCP 中撤销 → 原连接失效。写入授权只在测试工作区验证，不用真实工作项做破坏性测试。

审查加固：授权确认票据绑定浏览器会话且只能使用一次；已发放但尚未兑换的授权码也可以撤销；会话接口独立校验 Origin，不依赖全局宽松 CORS；只读 OAuth 的写请求返回 `403 insufficient_scope`；一体化代理将 `/mcp-connect` 留给前端。令牌兑换与刷新通过数据库行锁处理并发。

部署注意：OAuth 限流使用直接连接地址，不信任客户端可伪造的转发头；反向代理后的请求可能共享额度，入口代理应额外配置真实来源 IP 的速率限制。生产应明确设置 `CORS_ALLOWED_ORIGINS`、HTTPS 和安全 Cookie，并运行共享 Redis。当前没有自动清理 OAuth 历史记录的计划任务；记录保留不延长令牌有效期。
