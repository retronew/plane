# Lint Doctor 第十一轮修复 — 2026-10-19

分支：`fix/doctor-cleanup-round11`（基于最新 `preview` `0c383359ae`）

## 结果概览

| 指标                                | 修复前                         | 修复后                             |
| ----------------------------------- | ------------------------------ | ---------------------------------- |
| Doctor 诊断总数                     | 185（5 errors / 180 warnings） | **167（5 errors / 162 warnings）** |
| `no-high-complexity-react-function` | 67                             | **49**                             |
| 受影响文件                          | 144                            | 127                                |

本轮未新增任何其他规则诊断；规则计数变化只有复杂度一项。全量快照见 `Doctor剩余诊断-第十一轮-2026-10-19.json`。

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

## 验证

- `pnpm check`：60 个任务全部通过（format / lint / types）。
- Web 全量：**350 个测试文件 / 1656 项通过**。
- 定向测试：本轮改动区域 47 个文件 / 337 项通过；`@plane/blocks` 10 个文件 / 116 项通过。
- `space`、`web`、`blocks` 类型检查均通过；19 个改动文件 oxfmt 通过。
- Doctor 全量复扫：仅 `no-high-complexity-react-function` 由 67 降至 49，其余规则计数不变。

## 数据库

本轮无模型、迁移或 `apps/api` 改动，无需迁移或同步线上环境。

## 下一步

剩余 49 条复杂函数，最低档从 16–17 起：

- `rich-filters/filters-row.tsx` — `FiltersRow`（17/15）
- `cycles/active-cycle/cycle-stats.tsx` — `ActiveCycleStats`（19/27）
- `inbox/modals/create-modal/issue-properties.tsx` — `InboxIssueProperties`（20/17）
- `cycles/analytics-sidebar/issue-progress.tsx` — `CycleAnalyticsProgress`（20/19）
- `blocks/charts/bar-chart/root.tsx` — `BarChart`（20/20）
- `analytics/insight-option-icon.tsx` — `InsightOptionIcon`（20/97，嵌套极深）
