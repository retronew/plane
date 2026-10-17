# 项目工作流、审批与 Runner

本文描述当前仓库实现的项目级工作流。包含类型与多工作流、创建及流转约束、审批、真实 JavaScript Runner、SDK、执行记录与部署。实现保留 `workflows/default/` 兼容入口；不声称兼容官方全部 SDK、任意 npm/Python 依赖或工作区级治理。

Runner 的 HTTP 协议、错误码及引擎限制详见 [Workflow Runner README](../apps/workflow-runner/README.md)。

## 1. 配置模型与兼容行为

| 模型                                            | 职责                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `Project.workflow_enabled` / `workflow_version` | 项目总开关及策略版本，运行时只读取此总开关                                      |
| `ProjectWorkflow`                               | 名称、描述、默认标识、单项启停、版本、状态集合、初始状态及禁止直接创建的状态    |
| `ProjectIssueType`                              | 项目使用的类型、默认类型、可空工作流绑定；多个类型可共用一个工作流              |
| `WorkflowTransition`                            | 来源/目标、直接操作成员、普通流转或审批类型、拒绝目标、审批人模式、顺序脚本版本 |
| `WorkflowActivity`                              | 工作流名称快照、schema 版本及 before/after 配置快照                             |
| `WorkflowApproval`                              | 工作项进入审批状态时的分支、人员、版本与进入序号快照，以及最终决定              |
| `WorkflowScript` / `WorkflowScriptVersion`      | 脚本元数据与不可变发布版本，保存源码/hash/SDK 版本/能力/HTTP 策略               |
| `WorkflowExecution` / `WorkflowExecutionStep`   | 持久 outbox、执行租约、步骤结果、尝试历史、日志、指标及读取依赖                 |
| `WorkflowAction`                                | SDK 调用索引、方法与参数 hash、动作状态和幂等结果                               |
| `WorkflowCredential`                            | 项目内命名 HTTP 凭据、origin、注入头、密文及 key ID                             |
| `WorkflowApprovalEmail`                         | 按审批实例/接收人去重的邮件投递记录                                             |

迁移 `0140_typed_workflows` 扩展已有默认工作流，保留已有记录和规则，迁移项目总开关并回填工作流历史；`0141_workflow_runner` 增加脚本/执行/动作/凭据/邮件模型，`0142_workflow_retry_history` 增加步骤尝试历史。没有旧配置的项目保持关闭。读取默认工作流不创建数据库记录。

每项目最多一个有效默认工作流，工作流名称在项目内唯一。默认工作流涵盖项目所有普通状态；自定义工作流选择显式状态集合。状态与类型均须属于正确项目/工作区，triage 不纳入普通工作流状态集合。默认工作流不可删除；删除自定义工作流解除其类型绑定，类型回到默认工作流。

`ProjectWorkflow.enabled` 仅为旧 ORM/接口兼容镜像。项目总开关与 `is_active` 独立：总开关关闭或所选工作流 inactive 时暂停约束并保留配置。类型明确绑定 inactive 工作流时不会改选默认工作流来执行规则。

## 2. 类型解析、创建与状态流转

创建时省略类型使用有效的项目默认类型；更新时省略类型保留原值；显式 `type_id: null` 清空类型并解析至默认工作流。兼容旧 `type` 输入，两者同时提供且不一致时拒绝。跨项目、失效或已删除类型不可写入。项目类型编辑遇到被其他项目共享的 `IssueType` 时先复制当前项目使用的类型，避免改动其他项目。

服务端先解析类型，再解析有效工作流并检查状态。创建优先使用工作流初始状态；没有时使用项目默认状态，再回退到普通状态顺序。工作流生效时禁止在受限创建状态直接创建，初始状态始终允许创建。删除状态不得移除初始/转换/拒绝目标，也不得令任一存续工作流失去最后一个可创建状态；该保护包含 inactive 配置。

现有流转规则保持以下语义：

- 来源状态没有出站规则时，可在有效工作流状态集合中自由流转。
- 来源状态有普通出站规则时，只能进入配置目标；空直接操作成员集合表示所有原本有基础写权限的成员，显式成员集合进一步收窄权限。
- 管理员没有绕过路径或显式成员限制的特权。
- 仅改类型也验证目标状态集合；当前状态合法则保留，不合法时要求显式提供合法目标状态。普通类型切换仍受原工作流路径和审批约束。
- 来源为审批状态时，普通 PATCH、改类型、拖拽、公开 API、自动关闭或 SDK 写入不能绕过审批。
- 草稿保存可暂不执行正式流转规则，发布时完整校验；triage 保持独立，需求收集接受按最终类型选择创建状态。

应用与公开 API 的创建/更新、草稿发布、模板子项、需求收集接受、自动关闭以及 SDK 创建/更新复用公共校验路径。前端创建、详情/Peek、列表、看板及组合拖拽使用类型上下文过滤候选状态，服务端负责最终判定。组合拖拽先确认状态写入，再提交其他分组变更，避免状态被拒绝后留下部分变更。

## 3. 配置变更、影响预览与历史

项目设置提供工作流列表与详情、名称搜索、状态/类型筛选、白名单排序、类型绑定、状态集合、脚本与运行记录。配置草稿同步驱动侧栏及预览；“保存并继续”成功后保留来源并清空新规则目标/成员，失败保留输入。

绑定类型、修改自定义状态集合、删除工作流、移除使用中的类型以及有影响的重新启用通过 `workflows/preview/` 与 `workflows/apply/` 处理。预览包含策略版本、影响数量/样例、待映射状态、审批失效数量和签名 token。提交在项目锁内重新计算；策略、输入或受影响工作项变化时返回 `409 WORKFLOW_PREVIEW_STALE`，缺少必要映射则拒绝。预览签名有效期为 30 分钟。

管理迁移写入工作项前后状态/类型活动，取消旧审批，并在目标状态需要时创建新审批实例。管理迁移不执行普通流转边的前置/后置脚本，预览明确返回 `WORKFLOW_ADMIN_MIGRATION_SKIPS_SCRIPTS`。

工作流历史使用 `schema_version: 2` 的 before/after 快照，保留状态、成员 ID 和当时名称、all/explicit 模式与工作流名称。旧记录缺失字段按未记录展示。接口支持 `direction=asc|desc`，按时间/ID 稳定排序；每页 25 条，签名 watermark 固定结果上界，cursor 绑定项目/工作流/方向/水位。客户端切换排序重置分页，保存后失效历史缓存。状态展示按 backlog → unstarted → started → completed → cancelled、组内 sequence、稳定 ID 排序。

## 4. 审批闭环

同一来源的所有出站规则必须具有相同类型。审批来源可配置多个分支，每分支有批准目标、拒绝目标和审批人；批准与拒绝目标都需属于工作流且不等于来源；当前接口允许二者指向同一目标。脚本按 `outcome: approve|reject` 绑定，分别执行对应结果的前置与后置链。

工作项创建、发布、接受或迁入审批来源时，最终事务调用 `sync_issue_approval()`，为其建立唯一 pending 实例。实例冻结分支版本、状态/人员名称、审批人及进入序号。All 表示进入当时符合基础权限的有效项目成员，不表示以后加入的人自动获得旧实例审批资格。Explicit 表示指定的当时有效成员；决定时仍重新校验账号、项目/工作区成员身份与当前权限。

任一符合该分支要求的审批人可作出一次批准或拒绝，采用“一个合法决定生效”的语义，不是全员会签。决定携带审批实例/分支/版本/幂等键，先锁外执行对应前置，然后按项目 → 工作项 → 审批锁顺序重新验证并提交。并发决定只迁移一次；同一操作人/分支/结果的同幂等键返回已有决定，不同输入复用键则冲突。目标若也是审批来源，会创建下一次审批。

规则/脚本条件、类型绑定、成员权限和生命周期变化使旧快照失效；暂停、归档、删除取消 pending。重新申请或重新进入产生新快照和进入序号。详情/Peek 审批卡展示分支、状态、历史及批准/拒绝入口，过期实例不能再次决定。

审批生成站内通知，并在事务提交后排队邮件；邮件遵循个人状态变更偏好、当前有效成员和实例状态，按实例/接收人去重。没有邮件配置时保留 queued 等待后续补投。SMTP 发送前标记 sending，异常结果为 unknown，不自动重发不确定投递，避免重复邮件。

## 5. Runner 执行与事务边界

脚本编辑器保存元数据，发布新版本而不改写旧版本。每条规则绑定确切的 `script_version_id`、`phase: pre|post`、`outcome: transition|approve|reject`，最多 20 条步骤，按保存顺序执行。代码、授权、HTTP 策略、详细日志和凭据管理仅项目管理权限可见。

运行的脚本是 JavaScript 函数体，可直接使用 `context`、`sdk`、`console`、`return` 和 `await`。

```js
// 前置：使用本次拟提交字段，不把数据库旧值误认为新输入。
const name = context.proposed.name ?? context.before?.name ?? "";
return { success: name.trim().length > 0, reason: "请填写工作项名称" };
```

```js
// 后置：需要发布版本声明 addComment 能力，且执行身份仍有写权限。
const result = await sdk.addComment(context.work_item.id, "已完成工作流校验");
console.info("comment", result.id);
return { comment_id: result.id };
```

`context` 包含 `work_item`、`before`、`proposed`、`after`、`actor`、`flow`、`outcome`、`project_id`、`metadata`。前置的 `proposed` 是本次变化字段，`after` 是 before 与 proposed 的合并视图；后置在提交后以实际工作项快照更新 `after`/`work_item`。`sdk.getWorkItem()` 读取的是数据库当前项，因此判断本次输入应使用 proposed/after。

有脚本的写入经过三个阶段：

1. 读取并校验类型/路径，保存输入、策略及规则版本快照；在持锁事务之外顺序执行前置。调用方已有外层事务会被拒绝，避免网络执行长期占锁。
2. 在最终写入事务内重新锁定项目/工作项，核对输入 hash、工作项快照、策略/规则版本和所有 SDK 读取依赖；变化返回 `WORKFLOW_CONTEXT_STALE`，不能复用先前通过结果。
3. 同事务提交业务变更、审批及后置执行 outbox；提交后唤醒 Celery。事务回滚不派发后置。

前置只读，要求 `{success:boolean,reason?:string}`；只有 true 通过。false、throw、非法结果、超时、OOM 或 Runner 不可用均阻断，独立保留失败执行记录。Node 返回的外层 success 表示 JavaScript 执行成功，所以有效 `{success:false}` 会作为正常 result 返回，由 Django 转为 `PRECONDITION_REJECTED`。

后置在业务提交后执行，任一步失败停止剩余链，原业务变更及此前已完成动作保留。脚本测试执行真实 Runner，统一 `dry_run=true`；读操作真实读取，写动作返回计划且不持久修改项目，HTTP 只做策略/域名检查和 DNS 验证，不建立外部 HTTP 请求。测试结果保存 draft hash，源码/阶段/上下文/能力/策略变化后不能视为同一测试，且不代替正式流转校验。

## 6. SDK 与信任边界

| Promise 方法                                       | 参数与结果                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `getWorkItem(id?)`                                 | 同项目非草稿/未归档项的受限快照；省略 id 为当前项                        |
| `addComment(issueId, body)`                        | 非空纯文本，服务端转义生成评论；返回评论/工作项 ID                       |
| `addLabels(issueId, labelIds)`                     | 增加同项目有效标签，返回当前标签 ID                                      |
| `removeLabels(issueId, labelIds)`                  | 移除指定标签，返回当前标签 ID                                            |
| `updateWorkItem(issueId, changes)`                 | 白名单 `name,priority,start_date,target_date,state_id,type_id`；返回快照 |
| `createWorkItem(data)`                             | 同样字段白名单，name 必填；在当前项目创建并返回快照                      |
| `http({url,method,headers?,body?,credential_id?})` | 通过发布策略授权的 HTTP；返回 status 和脱敏截断 body                     |

这些是顶层 SDK 方法，没有 nested 命名空间，也不接受用户传入执行身份或项目来提升权限。每次调用验证当前执行/步骤租约、尝试号、策略/规则版本、项目/工作区范围、有效成员及能力交集。无 actor 的系统运行只允许读取当前项；不会冒充项目创建者。状态/类型写入重新经过公共工作流编排与审批规则。嵌套工作流执行深度上限为 5。

每个 Node `/execute` 对应一个步骤，调用 id 从 1 连续递增，parent 串行派发，`Promise.all` 也保持 Broker 接收顺序。Node 每步骤最多 20 次；Django `WorkflowAction` 对整个 `WorkflowExecution` 另有 **20 次总预算**，跨全部步骤共享，读与已入账失败调用也消耗名额。前置与后置分别是独立 execution；预算不是每个步骤再给 20 次。显式重试匹配已完成动作会重放结果，不新建动作名额；方法/参数 hash 不一致则幂等冲突。

调用路径是 Django 编排（前置 API 或后置 Celery）→ Node supervisor → 独立 child 内 QuickJS → parent → **Django API `/api/internal/workflow-runner/rpc/`** → SDK。Celery 不直接执行 SDK 的外部 HTTP，也不在 prefork daemon 内启动传输 child。

Runner 使用固定 `quickjs-emscripten@0.31.0`，每次独立 Node child，child 只接收源码与 JSON 上下文，无服务 token 或 capability。guest 无 Node/process/require/FS/env/fetch/模块加载器；CPU interrupt、heap/stack、parent 墙钟杀进程组及 RPC/日志/结果上限共同限制执行。不使用 Node vm 或 Django eval/exec。

Django 以专用 salt 签发 120 秒的 execution/step/lease/step_lease capability，仅 parent 经 Bearer 转发。Runner 的 Broker origin 来自可信配置，只允许固定 RPC path，禁 URL 凭据、query、fragment 和 redirect；请求 body 不能自由选择内部地址。服务 token 用于 API→Runner，不等于 Broker capability。

## 7. HTTP 策略、传输期限与凭据

HTTP 默认不可用：发布版本需声明 `http` 能力，配置明确的 HTTPS origin（当前仅 443）和方法。调用时再次交叉检查 execution/step/发布版本策略，项目成员权限和凭据状态。用户 header 仅允许 accept、accept-language、content-type、user-agent、x-request-id、x-correlation-id；认证头由命名凭据注入，不能用脚本头改变路由/代理/认证。

`workflow_sdk.py` 通过 `workflow_http_transport.bounded_http()` 执行请求。该 helper 从 API HTTP worker 使用 multiprocessing **spawn** 创建一次性传输进程；不用 fork 继承数据库连接和锁，不在 Celery daemon 中启动 child。输入仅为限定大小的 JSON，结果经分帧 bytes pipe 回传，不反序列化不可信 pickle。

父进程拥有 **5 秒硬传输期限**，覆盖子进程导入、DNS、TLS、等待响应头及流式读取。超时/异常后 terminate，必要时 kill，并 join/close 回收进程与管道；清理有短暂宽限。Node 步骤另有自身 5 秒 wall time，两者都可能先到期；Node 超时不能证明远端没有收到请求。

传输复用 `pinned_fetch` 的 SSRF/DNS 固定验证，`max_attempts=1`，不把版本白名单当成私网例外，不跟随重定向。3xx 仅返回状态，不读取/执行跳转。原始响应最多读取 64 KiB，SDK 向脚本返回脱敏后最多 8192 字符的 body，不返回响应头。校验 dry-run 只在同样进程期限内做 DNS 安全验证。

命名凭据绑定项目/origin/header，secret 只能写入，保存为带 key ID 的 Fernet 密文。API/worker 使用 `WORKFLOW_CREDENTIAL_KEY_ID`、`WORKFLOW_CREDENTIAL_KEY`；轮换把旧 ID→key 留在 `WORKFLOW_CREDENTIAL_PREVIOUS_KEYS` JSON 字典，直到旧凭据全部更换。未设置 current key 时现有代码回退 SECRET_KEY，生产应配置独立密钥；显式空 key 不等于可用密钥。Runner 不接收这些密钥。返回体过滤命名凭据、敏感 JSON 字段、认证样式及 URL query；原始传输异常和敏感头不写日志。

## 8. Outbox、重试与 unknown 人工处置

执行与步骤使用两分钟租约和 fencing token。每次获取执行/步骤、SDK 回调及结果提交都核对租约，过期进程不能继续写结果。Celery 唤醒失败保留 queued；Beat 每分钟补投，并回收过期 running。过期执行变 interrupted，不自动重跑已可能产生副作用的脚本。

同一工作项的后置链按 created_at/ID 顺序执行，较早 queued/running/unknown 会阻塞后续事件。内部写入和动作账本在同一事务提交，重复消息/回调匹配步骤索引和参数 hash 时返回已完成结果。显式重试仅适用于策略仍有效、没有 running/unknown 动作的 failed/interrupted 后置执行：attempt 增加，成功步骤跳过，其余步骤保存旧结果/日志/指标到 history 再排队。脚本重新走到已完成评论等动作时返回账本结果，避免重复写入。

HTTP 在发送前先提交 running 账本，再锁外传输。传输异常、超时、崩溃或未能记录响应不能证明外部是否成功，标记 `HTTP_OUTCOME_UNKNOWN` / `unknown`；不会自动重发，也不保证外部“恰好一次”。当前实现没有通用外部幂等键自动重试协议。

管理员应先去外部系统核实副作用，再在运行详情的人工处置入口填写结论与备注，或调用：

```http
POST /api/workspaces/{slug}/projects/{project_id}/workflow-executions/{execution_id}/resolve/
Content-Type: application/json

{"resolution":"completed","note":"已在目标系统核实请求产生的记录"}
```

`resolution` 为 `completed` 或 `abandoned`，note 必填，最长 1000 字符。仅可处置 unknown 且没有 running 步骤/动作的执行。completed 将 unknown 动作标记为人工确认完成，abandoned 标记为失败；两者都会记录 actor/时间/备注，取消未完成步骤并将 **整个 execution 永久置为 cancelled**。这不会补跑剩余脚本、不会声称整个 run 成功，也不会重新发送 HTTP。解除 unknown 阻塞后，后续 queued 事件可由 outbox 继续执行；原 execution 不能点 retry。

## 9. API 与代码位置

以下项目路由均位于 `/api/workspaces/{slug}/projects/{project_id}/`：

| 相对路径                                                                          | 用途                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------- |
| `issue-types/`、`issue-types/{id}/`                                               | 项目类型列表/创建/编辑/移除                 |
| `workflows/`、`workflows/{workflow_id}/`                                          | 工作流列表/创建/配置；`default/` 为兼容别名 |
| `workflows/{id}/states/`、`transitions/`、`transitions/{rule_id}/`                | 创建状态政策和规则配置                      |
| `workflows/{id}/activities/`                                                      | 工作流历史                                  |
| `workflows/preview/`、`workflows/apply/`                                          | 影响预览与管理迁移                          |
| `issues/{id}/approvals/`、`approvals/reapply/`、`approvals/{approval_id}/decide/` | 审批历史/重新申请/决定                      |
| `workflow-scripts/`、`workflow-scripts/{id}/versions/`、`workflow-scripts/test/`  | 脚本/不可变发布/真实 dry-run                |
| `workflow-executions/`、`workflow-executions/{id}/`、`retry/`、`resolve/`         | 执行列表/详情/显式重试/人工处置             |
| `workflow-credentials/`、`workflow-credentials/{id}/`                             | write-only 凭据管理                         |

项目设置中的「脚本与执行」是与工作流、自动化并列的管理员入口，地址为 `/{workspaceSlug}/settings/projects/{projectId}/runner/`。页面内分「脚本」和「执行历史」两个页签，集中管理项目脚本、版本、测试、凭据及运行记录。工作流详情继续配置前置/后置脚本版本绑定，并提供「查看执行记录」快捷链接，跳转到 `runner/?tab=executions&workflow_id={UUID}`；可清除筛选查看项目全部执行。入口调整不改变已有绑定、权限或执行机制。

内部 JSON-RPC 是 `/api/internal/workflow-runner/rpc/`，使用短期 capability，不是普通用户脚本可直接调用的公开能力。执行列表支持 issue_id、workflow_id 和 offset，每页 25 条；工作流筛选在分页前执行，同时匹配流转绑定和 context.flow.workflow_id 快照，保留规则删除后的历史可查性。详细结果携带步骤尝试历史、日志、指标及是否可重试。

关键源码：

- `apps/api/plane/utils/workflow.py`：类型解析、规则校验与 prepare/verify/finish 写入编排。
- `apps/api/plane/services/workflow.py`、`workflow_approval.py`、`workflow_lifecycle.py`：管理迁移、审批、生命周期失效。
- `apps/api/plane/utils/workflow_runner.py`：版本/能力校验、上下文快照、租约、步骤执行与恢复。
- `apps/api/plane/services/workflow_sdk.py`、`workflow_http_transport.py`：可信 SDK 与有硬期限的 HTTP 传输。
- `apps/api/plane/app/views/project/workflow*.py` 与 `app/urls/workflow*.py`：管理/审批/Runner/RPC 接口。
- `apps/api/plane/bgtasks/workflow_runner_task.py`：outbox 补投及审批邮件。
- `apps/workflow-runner/src/{server,supervisor,child,sandbox,protocol}.ts`：HTTP 服务、可信 parent、一次性 child 与 QuickJS。
- `apps/web/components/workflow/`、`store/project-workflow.store.ts`、`services/project/workflow.service.ts`：配置、类型、审批、脚本、运行详情及人工处置 UI。

## 10. 部署与运维

需要 API、Celery worker、Beat、Node Runner 和原有数据库/队列。API/worker 能访问 Runner，Runner 能回调 API Broker；仅启动 Node 服务无法完成 SDK。Runner 镜像要求 Node >=22.22.0，依赖固定在 catalog/lockfile。

| 配置                                           | 接收方             | 含义                                                                                 |
| ---------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `WORKFLOW_RUNNER_URL`                          | API/worker         | 默认 compose 使用 `http://workflow-runner:8080`                                      |
| `WORKFLOW_RUNNER_SERVICE_TOKEN`                | API/worker、Runner | 独立生成且一致的服务 token，Runner 要求至少 32 字符；Django 保留旧 TOKEN 名 fallback |
| `WORKFLOW_RUNNER_BROKER_URL`                   | API/worker         | `http://api:8000/api/internal/workflow-runner/rpc/`                                  |
| `WORKFLOW_RUNNER_BROKER_ORIGIN`                | Runner             | 可信 API origin，必须与 Broker URL 匹配                                              |
| `WORKFLOW_RUNNER_MAX_CONCURRENT`               | Runner             | 默认 2，范围 1–8，满载立即 429                                                       |
| `WORKFLOW_CREDENTIAL_KEY_ID/KEY/PREVIOUS_KEYS` | API/worker         | 凭据加密及轮换 keyring，不传入 Runner                                                |

root local/prod compose 和 community compose 均接入 runner，无公开端口、Docker socket 或 API env_file 挂载。运行用户 UID1000，readonly 根、cap_drop ALL、no-new-privileges、PID64、CPU1、512 MiB 内存以及 16 MiB noexec tmpfs；镜像 `/healthz` healthcheck。服务 token 应安全持久保存，不能放入前端环境或复用 SECRET_KEY。

```sh
# 一次本地会话示例：生成但不打印 token。
export WORKFLOW_RUNNER_SERVICE_TOKEN="$(openssl rand -hex 32)"
docker compose -f docker-compose-local.yml up -d --build --wait workflow-runner
docker compose -f docker-compose-local.yml up -d --no-deps --force-recreate api worker beat-worker
```

跨 shell 使用应将 token 写入不入库的私有 root `.env`，保持各服务一致。API env 示例列出 URL/token/凭据变量；不要给 Runner 加载 API 全量环境。community 需构建/发布匹配 `APP_RELEASE` 的 runner 镜像，或使用 `WORKFLOW_RUNNER_IMAGE` 指定私有仓库。

测试 compose 含真实 Runner，Broker origin 为 `http://api-tests:8000`；Django 集成测试的临时 Broker 绑定 `0.0.0.0:8000`。测试 token 为隔离网络公开测试值，不是生产默认。开发和测试若共用默认 Compose project，会争用同一个 workflow-runner service 容器；需要并存时应给**整套测试栈**统一独立 project（例如 `-p plane-workflow-test`），不要只移动 Runner 造成网络/DNS 不匹配。

## 11. 验证证据与交付边界

以下是 2026-10-16 最终验证结果。定向复验与全量批次存在覆盖重叠，**不能相加作为独立测试总数**。

| 批次                           | 最终结果                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 工作流后端综合与 URL 防护      | 400 passed、1 skipped，85.71 秒；含真实 Runner、69 SDK/transport、24可靠性、84 Runner API、42 outbox 用例 |
| 既有自动化、到期提醒、Intake   | 49 passed，8.62 秒                                                                                        |
| Node Runner 真实引擎/进程/HTTP | 21 passed                                                                                                 |
| Web 全量                       | 160 文件、579 tests passed                                                                                |
| 最后兼容调整前端定向复验       | 3 文件、13 tests passed                                                                                   |
| 类型与静态检查                 | Web/types/utils/i18n 类型、59 个后端改动文件 Ruff/格式、前端主体严格 lint/格式及 diff 检查通过            |
| React Doctor                   | 87/100，No issues found                                                                                   |
| Django 与迁移                  | check 0 issues，makemigrations --check --dry-run 无遗漏                                                   |

唯一 skip 对应公开成员 PATCH 仅支持 role、不能执行停用字段的契约；DELETE 生命周期另有覆盖，不计为通过。三个既有详情文件保留原有 lint 告警。所有后端 pytest 均在隔离测试栈运行。

Node 测试实际启动 QuickJS-WASM 和独立 child，包含 async SDK、false/throw/非法返回、同步/异步循环中断、wall/heap/stack、日志/RPC/结果限额、前置禁写、模块/Node/网络能力缺失、伪造 IPC、原型/序列化篡改、token 反射、顺序 RPC、child exit、鉴权和并发。镜像已完成构建以及 nonroot/readonly/capdrop/PID/CPU/内存限制下 Promise/console/CPU interrupt 冒烟。

Ego 使用专用 `Workflow Full Acceptance 20261016` 项目验收类型创建与预览绑定、创建窗口默认类型、详情批准、Peek 拒绝和审批活动、真实前置中文拒绝原因与状态保留、优先级即时更新、真实后置评论、失败后置显式重试与成功评论不重复、配置历史排序及保存并继续。390px 窄屏无横向溢出，状态标题最小宽度避免过度截断；实际深色主题检查后恢复浅色与普通视口。原项目和线上项目配置未修改。开发数据库 0140/0141/0142 已应用，升级前备份保存在 Downloads；测试 Runner 配置已恢复为开发配置。本轮代码尚未提交、合并或推送。

主要测试位于 `apps/api/plane/tests/contract/app/test_workflow_*.py`、`test_project_workflows.py` 以及 `apps/workflow-runner/tests/runner.test.mjs`。当前实现不提供全员会签、任意依赖/原生网络、任意模型字段写入或外部 HTTP 恰好一次保证；unknown 通过显式人工核实终止，保留可审计边界。
