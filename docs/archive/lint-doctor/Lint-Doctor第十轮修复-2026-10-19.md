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
