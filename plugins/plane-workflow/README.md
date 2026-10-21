# Plane Workflow

八项完整技能使用同一份业务正文：唯一编辑源为 `plugins/plane-workflow/skills/<skill>/SKILL.md`。Claude marketplace、Claude 上传插件、OpenAI 插件和通用下载共享全部八项流程。安装技能、注册 marketplace、安装插件、连接 MCP 是独立状态；只有只读自检成功才能报告已连接。

| 技能              | 完整流程                                            |
| ----------------- | --------------------------------------------------- |
| plane-setup       | 用户手动配置 MCP、检查身份与工作区                  |
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
claude plugin marketplace add retronew/plane
claude plugin install plane-workflow@plane-ai
```

目标 Git ref 必须包含本次版本。Claude Desktop 使用当前客户端实际提供的 marketplace 或插件上传入口。普通聊天附件不代表持久安装。上传插件使用 `/skills/plane-workflow-claude.zip`；其根目录包含 `.claude-plugin/plugin.json` 和 `skills/<八项技能>/`，没有外层目录。上传包和 marketplace 业务技能完全一致。

Claude marketplace 额外保留 `hooks/` 和 `agents/`，仅供支持这些能力的 Claude 客户端使用；上传包和 OpenAI 插件不包含它们。没有相关能力时不能承诺自动识别分支或运行代理。

支持插件命令的 Codex CLI 可注册并安装 OpenAI catalog：

```bash
codex plugin marketplace add retronew/plane --ref preview
codex plugin add plane-workflow@plane-openai
```

先用当前 CLI 的 `--help` 确认命令支持情况，再用 `codex plugin marketplace list`、`codex plugin list --marketplace plane-openai` 核对注册和安装状态。也可从仓库根目录运行 `codex plugin marketplace add .`。OpenAI 独立包为 `plugins/plane-workflow-openai`，内含八个完整 skill 目录；不含 hooks、agent 或连接配置。

ChatGPT 是否支持 marketplace 或自定义技能导入，由具体客户端、账户和工作区策略决定。由用户自己完成客户端安装与连接操作，不代点 ChatGPT 按钮，也不声称 CLI 注册已经完成 ChatGPT 安装。

支持 skills CLI 的客户端可发现并安装 canonical 八项技能：

```bash
npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/skills --list
npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/skills
```

`--list` 只发现；在交互安装器选择技能、客户端和范围。远程分支必须先包含这些源文件。安装后用 `npx skills list` 检查，再按客户端要求重新加载。覆盖已有自定义技能前先比较并确认，不默认添加跳过确认的选项。

通用 `/skills/plane-workflow.zip` 含八个顶层 skill 目录，供解压后安装到客户端的技能目录（例如 `~/.agents/skills/`），完整保留每项的资源子目录。这是多技能分发包，不能保证 ChatGPT 的单技能上传入口接受八目录 ZIP。只有客户端明确提供相应导入能力时才能使用。缺少安装能力时可阅读 Markdown 作为会话参考，不能报告持久安装成功。

## 手动连接 MCP

所有分发包都不声明内置连接，不生成 mcp.json，不提供 OAuth。由用户在 Plane「个人设置 → API 令牌」创建令牌，然后在客户端手动配置：

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

测试核对八项语义边界、完整目录和两类 ZIP 的字节一致性、CRC 与中央目录、无内置 MCP 配置、无真实秘密、版本一致及重新构建可复现。生成后一起分发源、生成目录、公开 Markdown 和 ZIP。测试直接检查生成产物，失败会中止现有 web 构建。
