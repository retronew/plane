# Lint / Doctor 第八轮（持续推进清理）

承接第六、七轮，分支 `fix/lint-doctor-cleanup` 已推送到 `origin`。未修改扫描配置、未禁用规则、未改动依赖。

## 固定口径结果

React Doctor 0.9.18，schema 3，`--scope full --json --blocking none --yes`，全部 10 个项目 `complete=true`、`skippedChecks=[]`。

| 检查               | 第六轮前 | 第七轮结束 | 现在 |
| ------------------ | -------- | ---------- | ---- |
| Doctor errors      | 6        | 5          | 5    |
| Doctor warnings    | 371      | 333        | 308  |
| Doctor 总诊断      | 377      | 338        | 313  |
| Doctor 总分        | 61       | 61         | 61   |
| 常规 lint warnings | 2        | 1          | 1    |

项目分数（第六轮 → 现在）：**admin 78 → 91**、web 70 → 72、space 86、blocks 84、editor 61、utils 89、live 75，hooks/i18n/types 100。相对 HEAD 的 changed 扫描（`--scope changed --base HEAD --include-untracked`）：**0 errors / 0 warnings**。

## 提交清单

| 提交         | 内容                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `513ed09028` | 会话与异步安全（Portal 引用计数、图片/链接/删除/项目创建会话隔离、MemberFilter 共享）+ 第六/七轮报告 |
| `ba05f4f1b9` | `DescriptionSkeleton`：peek 加载骨架与描述版本弹窗共用                                               |
| `e8c18ec915` | admin 五个 OAuth 表单：`useEffect` 上报脏状态改为 `useForm().subscribe`                              |
| `bd4352c23d` | `IssueDetailSkeleton`：browse 与归档工作项路由共用                                                   |
| `85c5b18b29` | `SettingsBreadcrumbHeader`：14 个设置路由共用（-294/+59）                                            |
| `07863dfd08` | `IssueQuickActionMenu`：5 个快捷操作下拉共用（-237/+105）                                            |
| `488e14786f` | `AppliedMembersFilters`：issues/modules/views 三处统一，chip 间距参数化                              |
| `c1eeca82f7` | 活动页分页状态上提，第一页与列表共享 SWR 缓存（新增 2 项测试）                                       |
| `c1da806787` | `useEffectEvent` 稳定 power-k 退出定时器；导航输入懒初始化                                           |
| `84e5d79d58` | `ProjectsLayoutShell`、`PageNavigationPaneEmptyState`、`DangerDialogHeader`                          |
| `d8ca0bec64` | `ProviderConfigFormLayout`：五个 OAuth 表单共用布局（-335/+217）                                     |

## 修复内容分类

**共享组件（消除 `duplicate-jsx-subtree`）**：9 个新共享组件覆盖 30+ 个重复文件，跨 web / admin 两个应用；`AppliedMembersFilters` 保留了两套 chip 间距（`p-1` 与 `px-1.5 py-1`），行为不变。

**数据流与状态**：

- admin 五个 OAuth 表单改用 `subscribe({ formState: { isDirty } })`，父组件在值变化时即收到通知，不再依赖渲染后的 effect；顺带把表单外壳抽成 `ProviderConfigFormLayout`。
- 个人活动页把 `total_pages` / `results` 的取得从「子组件 effect 回传父组件」改为父组件自己请求第一页；SWR key 与第一个列表实例一致，因此不产生重复请求（新增测试断言只请求一次）。
- `top-nav-power-k`：退出定时器改读 `useEffectEvent`，父组件传入新回调不再重启 220ms 计时（原先会反复重置、面板可能无法卸载）。
- `customize-navigation-dialog` 的 `useState(toString())` 改懒初始化；日历周表头 key 改稳定值（上一轮）。

## 本轮核实的误报（不改，附证据）

- `effect-needs-cleanup` 5 条（全部是剩余 error）：清理路径分别在 callback ref、ref+卸载 effect、Tiptap `destroy`、effect cleanup 中，规则无法跨函数追踪。
- `no-loading-flag-reset-outside-finally` 5 条：均已在 `finally` 内，外层条件是有意的会话隔离。
- `rendering-hydration-*` 12 条：web 为 `ssr: false`，无水合比对。
- `no-unused-vars` 7 条 + `async-await-in-loop` 4 条：workbox / `sw.js` 构建产物。
- `no-create-object-url-without-revoke`：`optimizeImageForUpload` 在同一个 `finally` 中 `revokeObjectURL`。
- `no-static-element-interactions` / `prefer-html-dialog` / `click-events-have-key-events` / `no-noninteractive-element-interactions`：编辑器容器与全屏图片查看器，源码中已有 `oxlint-disable` 与理由（原生 `<dialog>` 会进入浏览器 top layer，改变嵌套浮层与焦点行为）。
- `no-array-index-as-key` 2 条、`control-has-associated-label`、`no-autofocus` 4 条、`no-initialize-state` 2 条（弹窗打开/关闭动画需要的「先关闭态提交再打开」时序）、`no-adjust-state-on-prop-change` 5 条、`no-derived-state` 3 条。
- `no-pass-data-to-parent` 剩余 7 条：editor 公共 API `onAssetChange`（多调用点）、issue 表单的 `onChange(watch())`、RHF 的 `setValue` 默认类型、受控侧栏的 `onWidthChange`——都属于接口设计，改动面大于收益。

## 未修的结构性类别

`no-high-complexity-react-function` 90（88 个核心组件）、`js-set-map-lookups` 70（有测量证据：小集合 Set 更慢）、`only-export-components` 49、`prefer-dynamic-import` 17（正确做法是在消费侧做页面级懒加载）、`no-giant-component` 14、`duplicate-jsx-subtree` 剩余 7（跨 web/space/admin 三个应用的历史重复，提取到 `@plane/blocks` 属于架构调整）。

## 验证

- 全仓 `pnpm check`：format 16 / lint 16 / types 27 任务全部通过。
- Web 全量 344 文件 / 1636 项通过；Editor 全量 12 文件 / 54 项通过。
- Ego 浏览器（真实组件 + mock store）：admin provider 表单（Gitea 与 OIDC 两个 provider，含 OIDC 的「信任此提供商返回的邮箱」开关、右列回调 URI、脏状态取消确认、改回原值后直接关闭）；此前各轮另验证了链接会话、删除弹窗、项目创建、密码表单、图片尺寸。
- 每批次提交前均跑 `doctor --scope changed`，均为 0 诊断。

## 数据库

本轮全部改动位于 `apps/web`、`apps/admin`、`packages/editor`、`packages/blocks` 的前端代码，**没有任何数据库模型、迁移或 `apps/api` 变动**，因此无需执行迁移或同步线上环境。

## 收尾批次（同一轮内继续）

| 提交         | 内容                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `c5887c7638` | `IssueDateActivity`（开始/目标日期活动行）与 `FilterSearchInput`（三处筛选面板搜索框，`focusOnOpen` 参数化以避免 a11y 规则误报） |
| `49be4de0a3` | `PageEditorSkeleton`：页面内容加载器与版本预览共用（36 行骨架）                                                                  |
| `103a85acc0` | `FilterStartDate` 统一到 `isInDateFormat` 判断（issues 版此前用 `includes("-")` 会误判），选项查找改用 Set                       |

最终全量：**313 条**（5 errors / 308 warnings），`duplicate-jsx-subtree` 由 17 条降至 4 条（其余 4 条是 web / space / admin 三个应用之间的历史重复，需要提取到 `@plane/blocks`，属架构调整）；`js-set-map-lookups` 由 70 降至 68。

收尾验证：全仓 `pnpm check` 60 任务通过；Web 全量 1636 项、Editor 全量 54 项通过；每批次 `doctor --scope changed` 均为 0 诊断。

## 边界说明

本轮把「低风险且可回归」的项全部处理完：共享组件提取、数据流修正、误报核实。剩下 313 条中约 250 条集中在需要成规模重构的规则上（组件拆分、跨应用共享、页面级懒加载），逐条改动的回归面大于收益，已在「未修的结构性类别」中逐类说明理由。
