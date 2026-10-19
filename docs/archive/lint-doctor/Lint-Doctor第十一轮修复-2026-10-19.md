# Lint Doctor 第十一轮修复 — 2026-10-19

分支：`fix/doctor-cleanup-round11`（基于最新 `preview` `0c383359ae`）

## 结果概览

| 指标                                | 修复前                         | 修复后                             |
| ----------------------------------- | ------------------------------ | ---------------------------------- |
| Doctor 诊断总数                     | 185（5 errors / 180 warnings） | **114（3 errors / 111 warnings）** |
| `no-high-complexity-react-function` | 67                             | **0**                              |
| 受影响文件                          | 144                            | 84                                 |

`no-high-complexity-react-function` 已全部清零；其余规则计数只减不增。全量快照见 `Doctor剩余诊断-第十一轮-2026-10-19.json`。

## 已修复（19 个函数）

web：

- `workspace-notifications/sidebar/notification-card/item.tsx` — `NotificationItem`（17/13）：目标派生、守卫与头像/摘要/时间戳拆为模块函数与三个展示组件。
- `inbox/content/inbox-issue-mobile-header.tsx` — `InboxIssueActionsMobileHeader`（18/13）：七个菜单分支拆为具名菜单项组件，snooze 文案收敛为布尔值。
- `settings/profile/content/pages/general/form.tsx` — `GeneralProfileSettingsForm`（17/16）：`getProfileFormDefaultValues`、`getIsSMTPConfigured`。
- `browse/[workItem]/page.tsx` — `IssueDetailsPage`（18/15）：状态派生、service type、resize 同步、intake 跳转与路由守卫提为模块函数；错误态与容器拆组件。
- `settings/project/templates/editor.tsx` — `ProjectTemplateEditor`（18/16）：`resolveTemplateKind`、`getTemplateHeading`、`getTemplateLoadState` + `TemplateEditorContent`。
- `workspace-notifications/sidebar/notification-card/content.tsx` — `NotificationContent`（18/17）：翻译 key/值的派生提为函数，评论框拆 `NotificationCommentBox`。
- `api-token/modal/form.tsx` — `CreateApiTokenForm`（18/19）：有效期校验与 payload 构建提为函数，有效期整行拆 `ExpiryField` / `ExpiryHint`。
- `cycles/active-cycle/productivity.tsx` — `ActiveCycleProductivity`（18/22）：分布数据、待办文案、图表与主体拆为模块函数/组件。
- `active-cycles/cycle-card.tsx` — `WorkspaceCycleCard`（19/21）：状态颜色/图标查找表，项目头、操作头、图表类型选择、状态统计、其他状态与右栏拆组件。
- `settings/profile/content/pages/api-tokens.tsx` — `APITokensProfileSettings`（19/23）：错误态、搜索、表格、空状态拆组件。
- `hooks/use-favorite-item-details.tsx` — `useFavoriteItemDetails`（20/15）：五类收藏详情改为模块级 resolver，守卫与回退集中。
- `workspace-views/header.tsx` — `GlobalIssuesHeader`（20/16）：切换项构建提为函数，右侧操作区拆 `GlobalIssuesHeaderActions`，并去掉重复的默认视图查找。

space：

- `issues/peek-overview/layout.tsx` — `IssuePeekOverview`（16/15）：query 参数、peek issue、视图状态与面板名称提为纯函数。

blocks：

- `src/property-select/date-select-shell.tsx` — `DateSelectShell`（17/13）：触发器可访问名、tooltip 文案、Tooltip 包裹与清除底栏拆函数/组件。
- `src/property-select/date-range-select.tsx` — `DateRangeSelect`（17/17）：两端格式化、标签优先级、空值判断、日历选择与开合回调提为函数。
- `src/breadcrumb/breadcrumb-navigation-select.tsx` — `BreadcrumbNavigationSelect`（18/22）：选择逻辑提为 `runNavigationSelect`，标签控件与 crumb 控件拆 `NavigationControl` / `CrumbControl`。

web（项目概览与模块）：

- `project/overview/properties.tsx` — `ProjectOverviewProperties`（17/14）：状态/标签/成员/日期派生提为函数，属性行拆五个组件。
- `modules/modules-list-view.tsx` — `ModulesListView`（17/15）：`ModulesLoader` / `ModulesLayoutView` 拆组件，module id 与 slug 提为函数。

## 第二批（21 个函数）

- `rich-filters/filters-row.tsx` — `FiltersRow`（17/15）：按钮配置合并为函数，左/右/主内容拆组件。
- `cycles/active-cycle/cycle-stats.tsx` — `ActiveCycleStats`（19/27）：分布派生提函数，优先级/负责人/标签面板拆 observer 组件。
- `inbox/modals/create-modal/issue-properties.tsx` — `InboxIssueProperties`（20/17）：日期/选择器派生提函数，父工作项区域拆 `ParentIssueField`。
- `cycles/analytics-sidebar/issue-progress.tsx` — `CycleAnalyticsProgress`（20/19）：分组计数/分布/日期校验提函数，进度区拆两层组件。
- `blocks/src/charts/bar-chart/root.tsx` — `BarChart`（20/20）：栈数据、取色、shape 渲染与 margin 提函数，坐标轴/Bar/提示拆组件。
- `modules/module-card-item.tsx` — `ModuleCardItem`（20/21）：事件处理与统计提函数，头部操作/日期/负责人拆 observer 组件。
- `analytics/insight-option-icon.tsx` — `InsightOptionIcon`（20/97，嵌套 13）：13 层三元改为 null 原型查找表，保留日期后缀与兜底规则。
- `issues/.../sub-issues/issues-list/list-item.tsx` — `SubIssuesListItem`（21/15）：展开按钮、菜单、子项列表拆组件。
- `space/account/auth-forms/password.tsx` — `AuthPasswordForm`（21/17）：校验/提交提函数，字段与按钮拆组件。
- `onboarding/profile-setup.tsx` — `ProfileSetup`（21/19）：payload 构造与禁用态提函数，头像/姓名/密码/角色/用例/提交拆组件。
- `project/card-list.tsx` — `ProjectCardList`（21/21）：空态判断与布局提函数，空态拆组件。
- `comments/card/display.tsx` — `CommentCardDisplay`（21/22）：显示名/头像/反应判断提函数，头部/正文/反应栏拆组件。
- `integration/single-integration-card.tsx` — `SingleIntegrationCard`（21/38）：SWR key/fetcher、安装判断、描述、卸载流程提函数，操作按钮拆组件。
- `issues/issue-detail/main-content.tsx` — `IssueMainContent`（22/18）：`isDisabled` 统一，头部/描述/AI/底部拆组件。
- `settings/profile/content/pages/security.tsx` — `SecurityProfileSettings`（23/14）：按钮禁用与错误解析提函数，密码字段抽 `PasswordField`。
- `workflow/rule-editor.tsx` — `WorkflowRuleEditor`（25/24）：来源规则/可保存/步骤结果提函数，流程类型/目标状态/审批人/表单拆组件。
- `workflow/property-merge-dialog.tsx` — `PropertyMergeDialog`（27/25）：分组、组标签、选择校验、步骤推进提函数，三步表单拆组件。
- `issues/issue-layouts/properties/all-properties.tsx` — `IssueProperties`（37/33）：操作目标、模块/周期变更、更新 handler、布局与链接派生提函数；日期、模块/周期、估算、计数徽标、子项拆组件。
- `workflow/settings.tsx` — `WorkflowSettings`（36/36）：工作流合并/解析/过滤排序、筛选 options、错误上报提函数；列表区、详情区、筛选、行操作、面包屑、标题、弹窗编排拆组件。
- `project/card.tsx` — `ProjectCard`（36/32）：菜单项、类名、点击拦截提函数；封面/标题/操作/收藏/属性/弹窗拆组件。
- `project/card-properties.tsx` — `ProjectCardProperties`（25/25）：负责人/标签/日期派生与保存守卫提函数，四个属性行拆组件。

## 第三批（28 个函数）

- `sidebar/resizable-sidebar.tsx` — `ResizableSidebar`（22/20）：拖拽/peek 拆自定义 hook 与 `MainSidebar`/`PeekSidebar`/`ResizeHandle`。
- `blocks/src/property-select/member-select.tsx` — `MemberSelect`（22/22）：触发器 chrome、清除与搜索派生提函数，trigger/内容拆组件。
- `analytics/insight-entity.tsx` — `InsightEntity`（22/40）：实体链接与图标渲染提函数，类型守卫收窄。
- `issue-detail/.../activity/activity-list.tsx` — `IssueActivityItem`（23/1）：23 分支 switch 改 `ACTIVITY_RENDERERS` 查找表。
- `issue-layouts/list/block.tsx` — `IssueBlock`（23/19）：拖拽 effect 提 hook，选择/展开/快捷操作/属性拆组件。
- `issue-modal/base.tsx` — `CreateUpdateIssueModalBase`（23/19）：store 类型、草稿、创建与同步流程提函数，恢复动画提 hook。
- `cycles/analytics-sidebar/sidebar-details.tsx` — `CycleSidebarDetails`（23/20）：计数/估算派生提函数，描述/负责人/成员/工作项等拆组件。
- `editor/src/extensions/custom-image/components/block.tsx` — `CustomImageBlock`（25/16）：可见性/工具条/缩放派生提函数，图片与缩放手柄拆组件。
- `inbox/content/inbox-issue-header.tsx` — `InboxIssueActionsHeader`（26/24）：权限/跳转/下一个工作项提函数，操作菜单拆组件。
- `admin/instance/setup-form.tsx` — `InstanceSetupForm`（27/18）：表单初始值/错误/禁用态提函数，字段与错误横幅拆组件。
- `issue-layouts/list/list-group.tsx` — `ListGroup`（27/19）：展开/加载/拖拽派生与事件提函数，加载/列表/快速添加拆组件。
- `cycles/list/cycle-list-item-action.tsx` — `CycleListItemAction`（27/23）：状态/计数/收藏/路径提函数，计数/转移/成员/收藏拆组件。
- `account/auth-forms/password.tsx` — `AuthPasswordForm`（27/24）：动作 URL/禁用态提函数，字段与按钮拆组件。
- `issues/issue-layouts/kanban/kanban-group.tsx` — `KanbanGroup`（28/23）：预填数据/加载/拖拽判定提函数，加载更多与快速添加拆组件。
- `project/overview/update-discussion.tsx` — `UpdateDiscussion`（28/21）：评论权限/提交/错误解析/反应分组提函数，底部操作与评论面板拆组件。
- `blocks/src/select/trigger.tsx` — `SelectTrigger`（28/29）：tooltip/禁用/图标/标签派生提函数，chips/按钮/tooltip 拆组件。
- `issues/.../display-filters-selection.tsx` — `DisplayFiltersSelection`（31/28）：忽略项/属性/分组/排序/扩展项提函数，属性组与扩展项拆组件。
- `cycles/active-cycle/use-cycles-details.ts` — `useCyclesDetails`（31/18）：SWR key/fetcher 与筛选目标提函数，条件请求收敛。
- `issues/issue-modal/form.tsx` — `IssueFormRoot`（32/31）：标题/按钮/模板应用提函数，头部/描述/属性/操作拆组件。
- `project/overview/updates.tsx` — `Updates`（36/30）：权限/排序/保存删除守卫/异步动作提函数，表单/工具栏/卡片/反馈/列表拆组件。
- `project/overview/resources.tsx` — `ProjectResources`（34/27）：权限/反应分组/上传/删除流程提函数，头部/链接/附件/弹窗拆组件。
- `lib/wrappers/authentication-wrapper.tsx` — `AuthenticationWrapper`（34/52）：重定向决策改为 `loader | children | redirect` 纯函数组合。
- `settings/.../category-manager.tsx` — `CategoryManager`（37/44）：保存/排序/删除/默认项提函数，视图/头部/列表/编辑器拆组件。
- `settings/.../template-editor.tsx` — `TemplateEditor`（37/44）：草稿同步与保存提函数，视图/表单/字段组拆组件。
- `project/card.tsx` — `ProjectCard`（36/32）：菜单项/类名/点击拦截提函数，封面/标题/操作/属性/弹窗拆组件。
- `analytics/details.tsx` — `AnalyticsDetails`（42/54）：摘要/图表/表格派生提函数，摘要/趋势/图表/表格与单元格拆组件。
- `modules/analytics-sidebar/issue-progress.tsx` — `ModuleAnalyticsProgress`（43/45）：分组计数/分布/进度/日期提函数，进度体与面板拆组件。
- `layouts/auth-layout/workspace-wrapper.tsx` — `WorkspaceAuthWrapper`（44/38）：8 个 SWR 收敛到 hook，工作区派生提函数，未找到/无权限拆组件。
- `blocks/src/select/root.tsx` — `SelectRoot`（49/53）：拆为 `useResolvedSelection` / `useSelectItems` / `useSelectOpenState` / `useSelectSearch` / `useSearchKeyDown` / `usePopupSizing` 与 `SelectPopupContent` / `SelectSearchSlot` / `SelectStatusContent` / `SelectOptionsList` / `SelectEngine`。

## 收尾

- `navigation/use-responsive-tab-layout.ts`：把 `ResizeObserver` 的释放改为 callback ref 返回的 cleanup（React 19 在 ref 迁移与卸载时调用），移除单独的卸载 effect，清掉 1 条 `effect-needs-cleanup` error。
- 剩余 3 条 error 均为 `effect-needs-cleanup` 误报：`smooth-cursor.tsx` 在 effect 的 `return` 中完整移除监听与节点；`ai-handle.ts` / `drag-handle.ts` 的监听在 ProseMirror 插件的 `destroy` 中移除。

## 验证

- `pnpm check`：60 个任务全部通过（format / lint / types）。
- Web 全量：**350 个测试文件 / 1656 项通过**。
- 第三批定向测试：blocks `select` + `property-select` 13 个文件 / 172 项、editor 12 个文件 / 54 项、web 各区域定向用例均通过。
- `space`、`web`、`blocks`、`editor`、`admin` 类型检查均通过；三个批次共 68 个改动文件 oxfmt 通过。
- Doctor 全量复扫：`no-high-complexity-react-function` 由 67 降至 **0**；其余规则计数只减不增。

## 数据库

本轮无模型、迁移或 `apps/api` 改动，无需迁移或同步线上环境。

## 下一步

复杂度规则已清零。剩余 115 条诊断集中在：

- `only-export-components`（33）：组件文件同时导出类型/常量/hook 的约定问题。
- `prefer-dynamic-import`（16）：大型依赖（图表、编辑器）的懒加载。
- `no-unused-vars`（7）、`no-pass-data-to-parent`（7）、`no-unused-vars`、`rendering-hydration-mismatch-time`（7，`ssr: false` 既有误报）。
- `no-loading-flag-reset-outside-finally`（5）、`effect-needs-cleanup`（4）、`async-await-in-loop`（4）等。
