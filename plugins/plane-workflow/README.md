# Plane Workflow（技能与插件）

技能/插件与 MCP 是两个独立层：插件提供工作流程和操作规范；MCP 提供 Plane 工具及认证。**安装插件不等于 MCP 已连通**。ChatGPT / Codex 优先按下方 marketplace 方式安装 portable 插件；Claude Code 使用独立的 Claude marketplace。

让 Claude Code 以你本人的身份操作我们的 Plane：查待办、建任务、拆需求、排迭代、写文档、提交 PR 后自动更新任务。所有操作都通过你自己的 API Key 执行，权限与网页端一致，活动记录里显示的是你本人。

## Claude Desktop 插件安装

依据官方 [Use plugins in Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)、[Manage plugins for your organization](https://support.claude.com/en/articles/13837433-manage-plugins-for-your-organization) 和 [manifest / 标准目录参考](https://code.claude.com/docs/en/plugins-reference)。

### 从现有 marketplace 安装

Claude Desktop 打开 **Customize → Plugins → Add → Add marketplace → Add from a repository**，填写 `retronew/plane`（或 `https://github.com/retronew/plane`），添加后在 `plane-ai` marketplace 中找到并添加 `plane-workflow`。这是现有 Claude marketplace，标识为 `plane-workflow@plane-ai`，不使用 OpenAI 的 `plane-openai` catalog。仓库来源须包含现有 `.claude-plugin/marketplace.json` 及插件目录；组织策略可能限制可添加的来源。

现有市场插件包含 Claude Code 工作流。官方说明：Chat 中 skills / commands 可用，但 **hooks 和 subagents 显示为 inactive，不执行**；它们在 Cowork / Claude Code 中运行。不要期待 Desktop Chat 自动运行分支识别 hook 或 `plane-manager` 子代理。官方还说明本地 MCP server 仅在 Cowork / Claude Code 中运行。

### 上传便携插件 ZIP

下载 [`plane-workflow-claude.zip`](../../apps/web/public/skills/plane-workflow-claude.zip)（部署路径 `/skills/plane-workflow-claude.zip`）。官方已确认个人可以在 **Customize** 区域上传自建插件文件；上述帮助文章没有给出个人上传按钮的完整逐级路径，请以当前客户端实际提供的插件上传入口为准。普通聊天附件不等于安装插件。组织管理员的 ZIP 上传属于组织管理入口，不能当作个人安装路径。

此 ZIP 以插件根目录直接打包，只有以下两个文件，没有额外外层文件夹：

```text
.claude-plugin/plugin.json
skills/plane-workflow/SKILL.md
```

manifest 使用标准插件元数据；skill 与 `portable/plane-workflow/SKILL.md` 逐字节一致，合并连接检查、团队规范、待办、拆需求、周期规划及站会流程。包内不含 Claude Code hooks、subagents、MCP 配置、`userConfig` / `user_config` 或实际 token。它与仅含 `plane-workflow/SKILL.md` 的通用 `plane-workflow.zip` 是不同产物；上传插件时使用带 `-claude` 的 ZIP。

**Plane MCP 必须独立配置并认证。** ZIP 不提示填写凭据，也不会自动连接 Plane；在当前客户端的 MCP / 连接设置中单独配置，并先调用 `workspace(action="list")` 定位目标工作区，再用 `workspace(action="me", workspace_slug="<目标 slug>")` 核验身份与工作区。以客户端实际支持的传输与认证选项为准，不把 API token 填入聊天或插件包，也不能把其他客户端的配置文件当作 Desktop Chat 的安装步骤。未连通前只能草拟内容；本地 Git 操作还需要相应工具与用户授权。

## Claude Code marketplace 安装

```bash
claude plugin marketplace add retronew/plane
```

```bash
claude plugin install plane-workflow@plane-ai
```

安装时填写以下两项（之后可在 `/plugin` → plane-workflow → 配置 中修改）：

| 配置       | 说明                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| Plane 地址 | 如 `https://plane.example.com`，不要带 `/mcp`                                         |
| API Key    | Plane「个人设置 → API 令牌」中创建；存入系统钥匙串，不写进配置文件。只读 Key 只能查询 |

装好后运行 `/plane-workflow:plane-setup` 自检。

## 技能

| 命令                                   | 作用                                                           |
| -------------------------------------- | -------------------------------------------------------------- |
| `/plane-workflow:issue-next`           | 我接下来做什么：按逾期、优先级排出前 5 个待办，并提议开工      |
| `/plane-workflow:issue-start WEB-12`   | 开工：改为进行中、分配给自己、按规范建分支                     |
| `/plane-workflow:issue-ship`           | 提交：推送并建 PR，在工作项下评论 PR 链接，改为评审中          |
| `/plane-workflow:issue-plan-cycle WEB` | 迭代规划：从待办挑选工作项加入周期                             |
| `/plane-workflow:issue-breakdown`      | 拆需求：把一段需求或一个页面拆成父子工作项（先确认方案再创建） |
| `/plane-workflow:standup`              | 站会汇总：昨天完成、今天计划、风险，可写入 Plane 页面          |
| `/plane-workflow:plane-setup`          | 连接与自检                                                     |

另外：

- `plane-conventions`：团队规范（标题、优先级、状态流转、分支命名），Claude 在写 Plane 时自动遵循。项目可在 `.claude/plane.md` 中覆盖。
- `plane-manager` 代理：批量整理工作项（补标签、清理过期任务等），在独立上下文中运行，先列清单再执行。
- 会话开始时，如果当前分支名里有工作项编号（如 `fix/WEB-12-xxx`），Claude 会自动知道这次会话对应哪个工作项。

也可以直接用自然语言，例如「把 WEB-12 改成进行中并分配给我」「在 WEB 项目下建一个页面写这次的发布说明」。

## 不用插件，只连 MCP

Cursor、Codex 等客户端：在 Plane 创建 API Key 后，弹窗里可以一键复制 MCP 配置。也可以手动配置：

```bash
claude mcp add --transport http plane https://plane.example.com/mcp --header "Authorization: Bearer <你的 Key>"
```

## 工作区选择与自动跨区

`workspace(action="list")` 不需要 slug；其他工作区操作必须显式传 `workspace_slug`，缺失时先 list 定位，无法唯一确定则询问。连接配置不提供 `X-Workspace-Slug`，不使用最近访问或其他历史工作区作为默认值。个人 token 可跨本人有权限的多个工作区，workspace-scoped token 只能访问其绑定工作区。每次调用仍会检查工作区成员资格与项目权限。

技能先调用 `workspace(action="list")` 列出令牌可访问的工作区，按名称、slug 或链接自动定位；存在歧义时询问。确定后每次调用都显式传 `workspace_slug`，包括分页与写后核验，避免同名项目或相同工作项编号串区。跨工作区查询会分别调用并标注工作区和项目来源，不需要反复修改连接配置。

写入前核实目标工作区、项目、对象与权限，并确认具体操作范围；无权限时拒绝该目标操作，不切换到其他工作区操作同名对象。`workspace(action="list")` 是发现调用，无需先指定目标 slug；后续例如 `project(action="list", workspace_slug="team-a")`、`workitem(action="get", workspace_slug="team-a", work_item="WEB-12")`。参数以当前客户端实际工具 schema 为准。

## ChatGPT / Codex marketplace 安装（优先）

依据 [OpenAI 官方插件文档](https://developers.openai.com/plugins/build/plugins) 和 [Agent Plugins manifest schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)，仓库提供独立 OpenAI portable 插件：

- catalog：[`../../.agents/plugins/marketplace.json`](../../.agents/plugins/marketplace.json)，名称 `plane-openai`。
- manifest：[`../plane-workflow-openai/plugin.json`](../plane-workflow-openai/plugin.json)，插件名 `plane-workflow`。
- 自动发现的 skill：`plugins/plane-workflow-openai/skills/plane-workflow/SKILL.md`，从 portable 唯一源生成。

此插件合并查询待办、拆需求、周期规划、站会、团队规范和连接检查。包内没有 MCP 配置、凭据、专用 hooks 或代理；安装后仍须在 MCP 菜单中单独连接 Plane。它不会自动获得本地 Git 权限。

插件通过本仓库的 marketplace 分发，无需上架公共目录。远程安装时，目标 Git ref 需包含 catalog 和完整插件目录；也可直接从本地仓库安装。

### 注册 marketplace 与安装插件

已安装支持插件命令的 Codex CLI 时，从仓库根目录注册本地 catalog：

```bash
codex plugin marketplace add .
```

这些文件推送到 `preview` 后，可以改为远程注册（无需下载 ZIP）：

```bash
codex plugin marketplace add retronew/plane --ref preview
```

官方还支持完整 Git URL，例如：

```bash
codex plugin marketplace add https://github.com/retronew/plane.git --ref preview
```

官方支持 GitHub `owner/repo` 简写、带 revision 的简写、HTTP(S)/SSH Git URL 和本地目录；这里用明确的 `--ref` 避免依赖默认分支。`--sparse` 是 Git 稀疏检出路径选项，不是插件子目录选择器；本包还需要 `plugins/plane-workflow-openai`，不要只检出 `.agents/plugins`。

用 `codex plugin marketplace list` 核对注册结果。注册 catalog 后，按官方文档在 **ChatGPT desktop 的 Plugins Directory** 选择 `Plane Workflow` marketplace，再安装 `plane-workflow`；本地测试修改后需重启 desktop 再安装/更新。插件安装使用缓存副本，不会直接运行源目录。

Codex CLI 可根据[官方命令文档](https://learn.chatgpt.com/docs/developer-commands)安装插件。先运行 `codex plugin add --help` 确认当前版本支持，再执行：

```bash
codex plugin add plane-workflow@plane-openai
```

适用范围：portable 插件面向 ChatGPT 和 Codex；marketplace 注册不等于插件安装，安装后运行 `codex plugin list --marketplace plane-openai` 检查已安装插件，MCP 仍须独立连接。当前 CLI 不支持 `plugin add` 时，使用客户端实际提供的 Plugins Directory 或下面的通用技能方案。ChatGPT 网页版、移动版或普通聊天附件没有因此获得 Git marketplace 安装入口。

### MCP 连接（单独配置）

插件安装后，在支持的客户端另行配置 Plane MCP：`https://<Plane 域名>/mcp`，请求头 `Authorization: Bearer <Plane API token>`。不把实例地址、令牌或工作区写入共享 marketplace。

依据 [OpenAI 官方 MCP 客户端文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)，ChatGPT desktop、Codex CLI 和 IDE 使用同一 Codex host，共用 `~/.codex/config.toml`，支持 Streamable HTTP 的 `url`、`bearer_token_env_var` 和 `http_headers`。Plane API token 可作为 Bearer 请求头使用，无需把它转换为 OAuth 凭据。

1. 在 Plane「个人设置 → API 令牌」创建令牌；仅查询时可选只读令牌。
2. 在运行 Codex host 的环境中设置 `PLANE_API_TOKEN`。macOS / Linux 终端可运行 `export PLANE_API_TOKEN='<你的 Plane API token>'`；Windows PowerShell 可运行 `$env:PLANE_API_TOKEN = '<你的 Plane API token>'`。这些命令仅设置当前 shell 及其子进程；从该环境启动客户端。桌面客户端从图形界面启动时，须确保其 Codex host 也能读取该环境变量；仅在另一个终端中 export 不会更新已运行的桌面进程。不要把真实令牌粘贴到聊天、skill 或提交中。
3. ChatGPT 官方客户端打开 **设置 → 插件 → 右上角添加 → 添加 MCP 服务器**，选择 **Streamable HTTP**，填写 Plane `/mcp` 地址，保存后点击 **Restart**。认证可在共享配置中使用下方环境变量引用；编辑已有文件时合并该 server 配置，不要覆盖其他设置。

```toml
[mcp_servers.plane]
url = "https://plane.example.com/mcp"
bearer_token_env_var = "PLANE_API_TOKEN"
```

`bearer_token_env_var` 引用环境变量名，由客户端发送 `Authorization: Bearer …`；不要同时重复配置 Authorization 请求头。重启后先调用 `workspace(action="list")` 定位目标工作区，再用 `workspace(action="me", workspace_slug="<目标 slug>")` 核验身份与工作区。

ChatGPT 网页版不读取本地 `~/.codex/config.toml` 或环境变量，应使用网页实际提供的连接功能和认证选项。只有具体入口要求 OAuth 且无法发送 Plane 所需请求头时，该入口才受限，不能据此推断 desktop/CLI/IDE 不支持。安装 skill 不会自动配置 MCP 或完成认证；连通前只能草拟内容。无 shell/Git 工具时也不能执行或宣称完成本地 Git 操作。

## 通用方案：通过 npx skills 从 GitHub 安装

支持技能加载的客户端可通过 [skills CLI](https://github.com/vercel-labs/skills/blob/main/docs/commands.md) 安装便携技能，需有 shell、Node.js 和 npx。先确认远程 `preview` 分支已发布该技能：

```bash
npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/portable/plane-workflow --skill plane-workflow --list
```

`--list` 仅发现技能，不执行安装；源不存在或未发现 `plane-workflow` 时，应先解决来源问题。确认后安装：

```bash
npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/portable/plane-workflow --skill plane-workflow
```

在交互式安装器中选择目标客户端和项目级或全局范围。`--global`、`--agent` 和 `--yes` 可分别指定全局范围、客户端和跳过确认；Agent 未获明确授权时不要默认添加这些选项。保留已有技能，覆盖前先比较并确认。

安装后运行 `npx skills list`；全局安装用 `npx skills list --global`。按客户端要求重新加载，并确认其实际加载技能。此命令安装技能，不注册插件市场，也不配置 Plane MCP；仍需在 MCP 菜单独立连接，并用只读身份或项目查询验证。

没有 shell、npx 或受支持的技能加载方式时，使用下方 `SKILL.md` 备用方式；不支持持久技能的客户端可将其作为项目或自定义指令，检查长度限制并保留完整内容。普通对话附件仅在当前对话生效，不能视为持久安装。

## 下载 skill（marketplace 或 npx skills 不可用时备用）

### 文件与下载

- 唯一编辑源：[`portable/plane-workflow/SKILL.md`](portable/plane-workflow/SKILL.md)。
- Web 静态副本：[`../../apps/web/public/skills/plane-workflow/SKILL.md`](../../apps/web/public/skills/plane-workflow/SKILL.md)，部署后路径为 `/skills/plane-workflow/SKILL.md`。
- 可上传 ZIP：[`../../apps/web/public/skills/plane-workflow.zip`](../../apps/web/public/skills/plane-workflow.zip)，部署后路径为 `/skills/plane-workflow.zip`。压缩包只含 `plane-workflow/SKILL.md`，没有额外外层目录。

### ChatGPT

仅当你的 ChatGPT 账户、工作区和客户端提供自定义 skill ZIP 上传入口且管理员允许时，才能在那里上传 `plane-workflow.zip`。入口、配额及支持范围取决于产品和工作区策略；这不是所有 ChatGPT 会话通用的安装方式。普通聊天附件上传不等于注册可复用 skill，导入 ZIP 也不等于配置连接器。没有 skill 入口时，可以把 Markdown 作为当前会话的操作参考，但不能承诺自动发现或持久安装。

**必须先连接 Plane MCP。** ChatGPT desktop 可按上方「MCP 连接」通过 Streamable HTTP 和环境变量中的 Bearer token 配置；上传 skill 不会自动完成这一步。ChatGPT 网页版使用网页自身的连接功能，不读取本地配置；若具体入口仅支持 OAuth 且不能发送所需请求头，应说明该入口的限制，不能把 API token 当作 OAuth 凭据填写。认证未通时仅能草拟内容。

没有 shell/Git 工具的 ChatGPT 不能执行或宣称已执行建分支、提交、推送、建立 PR 等操作。

### Codex 本地安装

把单个文件安装为 `~/.agents/skills/plane-workflow/SKILL.md`，然后按客户端要求重新加载 skills。安装前检查目标文件，若已有自定义版本先备份或比较，避免覆盖。

macOS / Linux（从仓库根目录运行）：

```bash
mkdir -p ~/.agents/skills/plane-workflow
cp -i plugins/plane-workflow/portable/plane-workflow/SKILL.md ~/.agents/skills/plane-workflow/SKILL.md
```

Windows PowerShell（从仓库根目录运行）：

```powershell
$skillDir = Join-Path $HOME '.agents/skills/plane-workflow'
New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
Copy-Item -Confirm plugins/plane-workflow/portable/plane-workflow/SKILL.md (Join-Path $skillDir 'SKILL.md')
```

也可以用任意平台的文件管理器，创建该目录并复制文件，或解压 ZIP 后把 `plane-workflow` 目录放入用户的 `.agents/skills/`。其他支持 SKILL.md 的客户端按各自文档选择安装目录；不要把本插件的专用配置当作通用安装格式。

在 Codex 的 MCP 配置中另行连接 Plane：地址为 `https://<Plane 域名>/mcp`，认证请求头为 `Authorization: Bearer <Plane API token>`。令牌只填入客户端安全凭据设置，不写入 skill 或聊天。然后让 skill 先调用 `workspace(action="list")` 定位，再调用 `workspace(action="me", workspace_slug="<目标 slug>")` 自检。只有本地 Git 工具可用且用户授权时，才执行本地仓库工作流。

### 生成与验证

`pnpm --filter web build` 会先运行 `build:skills`，重新生成公开 SKILL、两个 ZIP 和 OpenAI 插件副本，再执行分发一致性测试；任一步失败都会中止 web 构建。`pnpm --filter web preview`、Turbo 和生产 Docker 构建均复用此入口。web 的 Turbo build 禁用缓存，确保每次构建重新生成；Docker 安装构建阶段显式复制 `plugins/` 和 `.agents/plugins/`，避免 `turbo prune` 丢失生成源与校验所需文件。生产镜像从该次 web 构建的 `build/client` 复制静态文件。

只生成与校验、不构建前端可运行 `pnpm --filter web build:skills`。需要 Node.js 22 或更新版本，无第三方依赖；也可在仓库根目录运行：

```bash
node plugins/plane-workflow/portable/build.mjs
node --test plugins/plane-workflow/portable/distribution.test.mjs plugins/plane-workflow/portable/marketplace.test.mjs
```

生成脚本从唯一编辑源复制公开 Markdown 和 OpenAI 插件 skill，并生成固定时间戳、无压缩的可复现 ZIP：通用 skill ZIP 只有一个文件；Claude 插件 ZIP 有根目录 manifest 和 `skills/plane-workflow/SKILL.md` 两个文件。Claude manifest 仅从现有插件选取公开元数据，不复制凭据配置或执行组件。Claude ZIP 测试核对完整文件清单、manifest 字段、源内容、每个条目的本地 / 中央目录偏移、固定时间戳、长度和 CRC，以及 200 MB 大小限制。marketplace 测试验证 manifest 基本字段及 schema 标识、catalog 策略、源路径边界、独立包结构及 skill 与源逐字节一致；这是所用 schema 字段的基本验证，不冒充完整通用 JSON Schema 校验器。修改源文件后重新生成，分发时一起包含源文件、公开副本和 ZIP。测试直接读取已生成的产物（不会先覆盖它们），校验逐字节一致性、ZIP 目录与 CRC、name/description metadata、六个流程及不依赖专用客户端工具。生成与测试均使用 Node，跨平台无需 shell 的 zip 命令。

## 常见问题

- **提示 API Key 无效**：Key 过期或已删除，重新创建后在 `/plugin` 中更新配置，再运行 `/mcp` 重连。
- **提示没有权限 / read-only**：你在该项目中是访客，或使用的是只读 Key。
- **看不到某个项目**：只有你是成员的项目才可见。
