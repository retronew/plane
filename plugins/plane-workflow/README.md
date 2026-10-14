# Plane Workflow（Claude Code 插件）

让 Claude Code 以你本人的身份操作我们的 Plane：查待办、建任务、拆需求、排迭代、写文档、提交 PR 后自动更新任务。所有操作都通过你自己的 API Key 执行，权限与网页端一致，活动记录里显示的是你本人。

## 安装

```bash
claude plugin marketplace add retronew/plane
```

```bash
claude plugin install plane-workflow@plane-ai
```

安装时会要求填写三项（之后可在 `/plugin` → plane-workflow → 配置 中修改）：

| 配置        | 说明                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| Plane 地址  | 如 `https://plane.example.com`，不要带 `/mcp`                                         |
| API Key     | Plane「个人设置 → API 令牌」中创建；存入系统钥匙串，不写进配置文件。只读 Key 只能查询 |
| 工作区 slug | 网址中工作区那一段；留空使用你最近访问的工作区                                        |

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
claude mcp add --transport http plane https://plane.example.com/mcp --header "Authorization: Bearer <你的 Key>" --header "X-Workspace-Slug: <工作区>"
```

## 常见问题

- **提示 API Key 无效**：Key 过期或已删除，重新创建后在 `/plugin` 中更新配置，再运行 `/mcp` 重连。
- **提示没有权限 / read-only**：你在该项目中是访客，或使用的是只读 Key。
- **看不到某个项目**：只有你是成员的项目才可见。
