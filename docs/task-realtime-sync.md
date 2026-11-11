# 任务实时同步

首期对应 PLANEBUG-37，包含服务端通道（PLANEBUG-38）、前端接入（PLANEBUG-39）及集成验收（PLANEBUG-40）。

## 数据流

任务写入 → 数据库事务提交 → Redis `plane:sync:v1` 失效事件 → live WebSocket → 浏览器订阅合并 → REST 重新查询 → MobX 实体、分组、分页及计数更新。

数据库和既有 REST 权限仍是事实来源。事件不包含标题、描述等任务内容；任务描述继续沿用已有 Plate/Yjs 协同。

## 服务端

- `GET /api/workspaces/<slug>/sync/access/` 使用现有会话认证，返回工作区及可订阅项目 ID。
- `LIVE_BASE_PATH + /sync/workspaces/:workspaceSlug` 是独立 WebSocket 通道，要求 Cookie、受信任的精确 Origin 和有效工作区成员身份。
- 服务端消息为 `ready`、`invalidate`、`resync`、`access_revoked`，协议版本为 `1`。`ready/resync` 附带 `project_ids`；项目变更通知带 `project_id/event_id`，可选 `issue_ids`。
- 建连、推送前和每 30 秒核验权限；并发同会话核验合并。访客不订阅项目级推送，避免项目内任务可见范围不同带来的元数据泄露；当前仅项目角色至少为成员的用户订阅。
- 原生 WebSocket ping/pong 检查存活；浏览器无需发送应用消息。连接清理会释放定时器、Cookie 引用和待发事件。
- Django signals 覆盖任务及标签、负责人、周期、模块等关联变动；共享 QuerySet 覆盖 `update/bulk_create/bulk_update`，成功写请求中间件作为补充。
- 事件在 `transaction.on_commit` 后发布。同请求/同保存点合并项目事件；失败响应、回滚不发布。合并适配器小范围使用 Django 的 `run_on_commit` 队列，有嵌套回滚测试保护。
- Redis 发布超时受限，失败后短时熔断；普通 CRUD 不依赖广播成功。

## 前端

`SyncEngine` 将连接和订阅路由与具体任务视图分离。每个订阅提供稳定 key、可选项目 ID 及刷新函数。

- 同 key 订阅去重、150ms 合并事件、单 key 请求串行化；请求进行中又收到事件时，在结束后再校准一次。
- 指数退避重连，收到 `ready/resync` 校准；每 30 秒以及恢复网络/页面可见时补偿刷新。
- 当前实际取过数据的列表才订阅，复用各 store 的 `fetchIssuesWithExistingPagination`。页面卸载和切换视图清理订阅，历史缓存不持续刷新。
- 详情只拉当前任务；保持已有描述协同和表单本地状态。403/404 移除实体和列表引用，关闭对应弹窗；撤权立即清理项目缓存。
- 本地任务相关写请求暂停远程刷新并中断旧列表请求；响应 revision 防护阻止写入前的 GET 重新覆盖数据。写请求完成后的下一任务恢复，留出调用方 store reconciliation 时间。
- 输入期间暂缓远程刷新，失焦后继续校准。未保存内容不被静默重置；此机制不提供属性级 CRDT 或离线合并。

## 运行与发布

复用现有 `REDIS_URL`、live `API_BASE_URL/CORS_ALLOWED_ORIGINS/LIVE_BASE_PATH` 和 web `VITE_LIVE_*` 配置，无新增数据库迁移或依赖。

部署需要更新 API、后台 worker/beat 和 live/web，以便所有写入进程加载 signals/QuerySet hook。浏览器已有构建仍需载入新版 web。代理必须保留 `/live` 下的 WebSocket Upgrade 与会话 Cookie；CORS Origin 需包含实际前端来源。

## 一致性边界

Redis Pub/Sub 不提供持久回放；进程在数据库提交后、发布前退出会丢失通知，依赖重连和周期 REST 校准恢复。原始 SQL 绕过 hook。每 30 秒补偿用于最终一致，不承诺故障期间的 2 秒延迟。项目访客尚不接收实时推送。跨用户、多实例的服务端行为有自动测试，本次本地真实 UI 使用同一账号的两个独立标签页，未完成真实双账号、多实例部署或线上验收。

## 本次验证

- 本地页面：`http://localhost:3000/`，测试工作区 `wuzuo`，项目 `MCP 测试`。
- 新建专用任务 MCPT-8/MCPT-9，验证创建、标题、状态、优先级、归档、恢复及删除同步；测试完成后两项已删除，原有任务未修改。
- 状态跨标签页更新约 1.2 秒，优先级列表到详情约 1.2 秒，删除跨标签页移除约 1.4 秒。标题计时包含 UI 自动保存延迟，不作为纯传输延迟。
- 实际停止/恢复本地 live 服务，验证中断期间 CRUD 成功，恢复后详情无需刷新自动校准。
- 前端同步及任务状态/弹窗回归共 51 项、后端新增 16 项、既有 workflow/cycle 73 项、live 同步及已有协同 36 项通过。
- live 类型/构建、定向 lint、Python Ruff 通过；React Doctor 为 98/100，无诊断问题。web 全量类型检查仍在未修改的 admin 通知测试及跨项目导入处报错，本次同步文件无类型错误。
