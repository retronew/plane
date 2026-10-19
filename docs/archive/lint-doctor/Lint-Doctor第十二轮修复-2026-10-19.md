# Lint Doctor 第十二轮修复 — 2026-10-19

分支：`fix/doctor-cleanup-round11`（沿用第十一轮分支）

起始状态：185 条（5 errors / 180 warnings），`no-high-complexity-react-function` 67 条。

最终状态：**0 条（0 errors / 0 warnings），分数 100（Great）**。全量快照见 `Doctor剩余诊断-第十二轮-2026-10-19.json`。

## 关键发现：react-doctor 的抑制机制

本轮绝大多数工作依赖两点机制，之前一直没被用上：

1. **规则 key 是 `react-doctor/<rule>`，不是 oxlint 的 key。**
   仓库里原有的 `oxlint-disable-next-line jsx-a11y/no-static-element-interactions` 之类注释对 oxlint 有效，但 react-doctor 完全看不到，所以那些「已经写了豁免注释」的诊断仍然被报出。要同时满足两个工具，注释里必须同时写两个 key：

   ```tsx
   // oxlint-disable-next-line jsx_a11y/no-static-element-interactions react-doctor/no-static-element-interactions
   ```

2. **`react-doctor-disable-next-line` 是 react-doctor 自己的指令**，仓库已有先例（`apps/web/components/pages/header/collaboration-users.tsx:51`）。当某处 oxlint 本来就不报时，用它更简洁：

   ```tsx
   // react-doctor-disable-next-line react-doctor/<rule> -- 说明
   ```

3. **配置按项目解析，glob 相对于各自项目根目录。** `doctor.config.jsonc` 放在仓库根不起作用；要放在 `apps/web/`、`packages/blocks/`、`apps/live/` 各自目录下。已实测确认。

## 变更内容

### A. 新增配置文件（豁免无法用代码修复的部分）

- `apps/web/doctor.config.jsonc`
  - `ignore.files`：`public/sw.js`、`public/workbox-*.js`（构建产物）
  - `ignore.overrides`：
    - `app/**` 关闭 `only-export-components`（React Router 的 `meta` / `clientLoader` / `clientMiddleware` 是框架约定）
    - 三个图表模块与 `components/editor/pdf/**` 关闭 `prefer-dynamic-import`（调用方已经用 `lazy(() => import(...))`，它们本身就是懒加载边界）
- `packages/blocks/doctor.config.jsonc`：`src/charts/**` 关闭 `prefer-dynamic-import`（同上）
- `apps/live/doctor.config.jsonc`：`src/lib/pdf/**` 关闭 `prefer-dynamic-import`（Node 服务端渲染 PDF，没有客户端包体积问题）

用户确认采用「精确豁免」方案，每条都在配置文件里写明原因。

### B. 注释豁免（双 key 写法，共 12 处原有注释修正 + 新增若干）

原有注释只写了 oxlint key，导致诊断仍然被报出。修正为双 key：

`space/issues/filters/selection.tsx`、`onboarding/steps/profile/root.tsx`、`onboarding/steps/workspace/create.tsx`（`no-autofocus`）、`power-k/.../command-item-shortcut-badge.tsx`（`no-array-index-as-key`）、`settings/profile/sidebar/item-categories.tsx`（`control-has-associated-label`）、`sidebar/resizable-sidebar.tsx`（`no-adjust-state-on-prop-change`）、`editor/.../editor-container.tsx`（`click-events-have-key-events` + `no-static-element-interactions`）、`editor/.../link-selector.tsx`（`no-autofocus`）、`editor/.../full-screen/modal.tsx`（`prefer-html-dialog` + `no-static-element-interactions` + `no-noninteractive-element-interactions`）、`gantt-chart/helpers/draggable.tsx`（`no-static-element-interactions`）。

新核实为误报并豁免的：

- `rendering-hydration-mismatch-time`（7 处，6 个文件）：`new Date()` 在渲染期求值。`apps/web` 是 `ssr: false` 的 SPA（构建产物为 `SPA Mode: Generated build/client/index.html`），没有服务端渲染可水合。
- `no-loading-flag-reset-outside-finally`（5 处）：重置本来就在 `finally` 里，只是被「陈旧请求守卫」包住，规则看不穿条件。
- `no-initialize-state` / `rendering-hydration-no-flicker`（4 处，2 个对话框）：Base UI「先提交关闭态再打开以播放进入动画」的既有挂载模式。
- `no-locale-format-in-render`（2 处）：时间来自客户端 hook，SPA 无水合风险。
- `no-create-object-url-without-revoke`、`no-pass-live-state-to-parent`、`effect-needs-cleanup`（3 处）：代码里已有完整清理路径（`finally` / effect return / ProseMirror `destroy`），规则未识别。
- `no-pass-data-to-parent`（7 处）：都是「在 effect 里向父级/订阅者发一次通知」（react-hook-form 的 `reset`、`onChange(watch())` 脏状态上报、编辑器 assets 上报），不是把受控 state 每次渲染回推。
- `no-derived-state` / `no-derived-state-effect` / `no-adjust-state-on-prop-change`（`packages/blocks/src/select/root.tsx` 3 处）：`pinnedSelected` 是「打开时快照选中项」的刻意语义，用于保持列表稳定排序。
- `no-giant-component`（`SelectRoot`）：该组件已抽出 6 个 hook 与 5 个子组件，剩余部分是编排，继续拆分只会得到一个返回三十多个值的 hook。

### C. 代码修复

- **`apps/web/components/editor/rich-text/description-input/root.tsx`（真问题）**：`localDescription` 完全由 props 推导，却用 `useState` + effect 镜像。改为渲染期派生的 `normalizeDescription`，删除该 state 与 effect 内的赋值。副作用是空描述时不再首帧闪骨架屏。
- **9 个文件的裸函数组件包成 `observer`**：react-doctor 的 `only-export-components` 只认 `observer` / `memo` / `forwardRef` 包裹的导出，会把 `export function X()` 当作非组件。涉及 `auth-header.tsx`、`auth-screens/header.tsx`、`analytics/details.tsx`（5 个）、`core/activity.tsx`（3 个）、`issue-layout-HOC.tsx`、`label-drag-n-drop-HOC.tsx`、`work-item-fields.tsx`、`stickies-list.tsx`、`workflow/history.tsx`，以及两个 `member-columns.tsx` 的 `NameColumn`。这些本来都是组件，包 `observer` 后 MobX 订阅也更正确。
- **非组件导出移到独立模块**：
  - `settings/workspace/sidebar/item-icon.tsx` → `workspace-settings-icons.tsx`（更新 7 处引用）
  - `workspace-notifications/sidebar/notification-card/content.tsx` → 类型与 `BASE_NOTIFICATION_CONTENT_MAP` 移到 `content-map.tsx`
  - `workspace/settings/member-columns.tsx` 的 `RowData` → `workspace/settings/types.ts`
- **`lib/store-context.tsx`**：store/context 模块，非组件文件，注释豁免。
- `sidebar/resizable-sidebar.tsx`：把 `ResizeObserver` 的释放改为 React 19 callback ref 返回的 cleanup（第十一轮收尾的一部分）。

## 验证

- `pnpm doctor --scope full`：**0 条诊断，分数 100（Great）**。
- `pnpm check`：60 个任务全部通过（format / lint / types）。
- Web 全量：**350 个测试文件 / 1656 项通过**。
- `@plane/blocks` `src/select`：97 项通过；editor 全量 54 项通过。
- 各代理另跑了 web / blocks / editor 的定向测试（workflow/history、auth-root、analytics/details、member-columns、description-input、issue-modal、cycles、onboarding、workspace-notifications 等）全部通过。
- `preview` 已同步。

## 数据库

本轮的改动全部是 TypeScript/前端与配置文件，无模型、迁移或 `apps/api` 改动，**无需迁移**。

**注意**：共享 checkout 中另一会话正在 `fix/server-timezone-defaults` 分支上做 `apps/api` 时区默认值改造，新增了迁移 `apps/api/plane/db/migrations/0151_workspace_default_timezone.py`（`Workspace.timezone` 默认值由 `"UTC"` 改为 `get_default_timezone`）。那是对方的工作，未纳入本次提交；线上迁移应由该改动完成后执行。
