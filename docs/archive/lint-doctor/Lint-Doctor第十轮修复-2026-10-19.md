# Lint / Doctor 第十轮（复杂函数）

从合并后的 `preview` 起的新分支 `fix/doctor-cleanup-round10`，未修改扫描配置、未禁用规则。

## 固定口径结果

React Doctor 0.9.18，schema 3，`--scope full --json --blocking none --yes`，全部 10 个项目 `complete=true`。

| 检查                                | 第九轮结束 | 现在 |
| ----------------------------------- | ---------- | ---- |
| Doctor errors                       | 5          | 5    |
| Doctor warnings                     | 203        | 198  |
| Doctor 总诊断                       | 208        | 203  |
| `no-high-complexity-react-function` | 90         | 85   |

`--scope changed --base HEAD --include-untracked`：0 诊断。

## 修复内容

五处「分支太重」的组件，用两种手法降低复杂度，行为不变：

- `exporter/single-export.tsx`：provider / status 的嵌套三元改为 `PROVIDER_LABELS` / `STATUS_STYLES` 查找表（未知值回退空串，与原 `: ""` 一致）。
- `app/(all)/workspace-invitations/page.tsx`：页面只保留状态与两个 handler，渲染交给 `InvitationBody`，后者按「待接受 / 已回应 / 加载中」分派给 `InvitationActions`、`InvitationAlreadyMember`、`InvitationInactive`、`InvitationNotFound` 四个叶子组件；分支从嵌套三元改成提前 return。
- `issues/peek-overview/view.tsx`：`PeekOverviewContent` 把 embedded/side-peek/modal 与 full-screen 两种布局抽成 `PeekEmbeddedContent` / `PeekFullScreenContent`，共享的 props 用一个 `sharedProps` 对象传入；`is_archived` 在边界处 `Boolean()` 收敛，两个子组件沿用 `disabled = false` 的默认值。
- `core/modals/user-image-upload-modal.tsx` 与 `workspace-image-upload-modal.tsx`：拖拽区 class、预览 `src` 与文件拒绝文案三处三元链提为模块级 `dropzoneClassName` / `previewSrc` / `rejectionMessage`（后者接受 `readonly` 的 `FileRejection[]`）。

验证：`pnpm check` 全绿；peek-overview / exporter / workspace-invitations 11 项、core 36 项测试通过；每批 `doctor --scope changed` 0 诊断。

## 剩余 85 条的构成

复杂度集中在 issues 布局、认证表单、实例设置等核心组件（多数 15–20，最高 27），分支本身是业务语义的一部分。继续处理需要逐个重写控制流并补充回归，收益是"可读性"而非缺陷修复，因此按单文件、可回归的节奏推进，不做批量机械拆分。

## 数据库

本轮无任何模型、迁移或 `apps/api` 改动，无需执行迁移或同步线上环境。

## 后续批次：十个复杂函数

在首批 5 个之后又处理了 10 个（`no-high-complexity-react-function` 85 → 75）：

- `issues/issue-layouts/roots/cycle-layout-root.tsx`：状态与进度派生收进 `getCycleDerivedState`。
- `power-k/.../work-item/commands.ts`：三个 `isEpic ? … : …` 合并为一个 `useMemo` 的 `entityApi`，回调依赖保持稳定。
- `packages/blocks/src/emoji-icon-picker/logo.tsx`：icon 分支抽成 `renderIconLogo`。
- `active-cycles/root.tsx`：SWR key、denied、hasMore、loadingMore 四个派生提为模块级函数。
- `inbox/content/issue-properties.tsx`：`getOpacityClass` 辅助函数 + `IntakeStateProperty`、`DuplicateOfWorkItem` 两个组件。
- `space/.../peek-overview/issue-properties.tsx`：优先级 className 的嵌套三元改为 `PRIORITY_CLASSES` 查找表。
- `workflow/runner-settings.tsx`：`resolveActiveTab`、`resolveWorkflowName` 辅助函数 + `RunnerLoadState`、`RunnerTabs` 组件。
- `workflow/approval-card.tsx`：六个渲染分支拆成同文件组件，两个守卫表达式抽成 `hasApprovalSource` / `shouldRenderApproval`。
- `labels/project-setting-label-list.tsx`：草稿表单与列表内容拆成 `LabelDraftForm` / `LabelListContent`。
- `workspace/settings/members-list.tsx`：成员目录与待处理邀请拆成 `MembersDirectory` / `PendingInvitations`。

验证：Web 全量 **345 文件 / 1640 项**通过，全仓 `pnpm check` 通过，每批 changed 扫描 0 诊断。

## 第三批：再八个复杂函数（75 → 67）

- web 与 space 的 `oidc-email-bind.tsx`：两个表单步骤拆成 `EmailStepForm` / `CodeStepForm`，重发按钮文案用共享 `resendLabel` 提前返回。
- `analytics/comparison-chart.tsx`：把朝向相关的高度、布局、margin、坐标轴类型、柱半径与 tick 格式化全部提为模块级函数/常量，组件体内不再有三元。
- `sub-issues/filters.tsx`：新增 `SubIssueFilterItem`，七个 `isFilterEnabled(...) && <div>` 变成带 `enabled` 的组件。
- `issue-detail/sidebar.tsx`：`toDateValue` / `deriveBoundaryDate` / `toPayloadDate` 三个纯日期辅助 + `cn` 条件类。
- `all-issue-layout-root.tsx`：路由参数收敛、两个 SWR key、空视图守卫提为模块函数。
- `spreadsheet/issue-row.tsx`：`getIssueServiceType` + `IssueIdentifierCell` / `IssueSelectionCell` / `SubIssuesChevron` 三个展示组件。
- `draft-issue-properties.tsx`：`toDateValue` / `getAssigneeVariant` / `getDueDateHighlight` / `getDefaultLabelOptions` 提为模块函数。

最终全量 **185 条**（5 errors / 180 warnings）。
