# Lint / Doctor 第七轮修复

本轮承接第六轮，基于 `fix/lint-doctor-cleanup` 工作区，未提交、未推送。未修改扫描配置、未禁用任何规则、未改动依赖。

## 固定口径结果

React Doctor 0.9.18，schema 3，`--scope full --json --blocking none --yes`，全部 10 个项目 `complete=true`、`skippedChecks=[]`。

| 检查               | 第六轮结束 | 第七轮结束 |
| ------------------ | ---------- | ---------- |
| 常规 lint errors   | 0          | 0          |
| 常规 lint warnings | 1          | 1          |
| Doctor errors      | 6          | 5          |
| Doctor warnings    | 354        | 333        |
| Doctor 总诊断      | 360        | 338        |
| Doctor 总分        | 61         | 61         |

项目分数（第六轮 → 第七轮）：web 70 → **72**，blocks 84 → 84，editor 61 → 61，space 86，admin 78，live 75，utils 89，hooks/i18n/types 100。

相对 HEAD 的 changed 扫描（`--scope changed --base HEAD --include-untracked`）：**0 errors / 0 warnings**。该扫描分数不与 full 分数比较。

## 修复内容

- 日历周表头 `week-header.tsx`：`key` 由「每次渲染新建 `Intl.DateTimeFormat` 再格式化出的日期文本」改为稳定的 `day.value`。原写法使 key 随语言/时区变化，React 会重建全部表头；同一行的 `Intl` 实例化也正是 `no-random-key`（error）与 `no-locale-format-in-render` 的来源。新增 `week-header.test.tsx`（2 项）：断言语言切换后 7 个表头节点保持同一实例、文本更新为中文，且周末开关只影响单元格数量。**该测试在旧实现上失败（1 failed），确认覆盖了回归。**
- 快捷键徽标 `command-item-shortcut-badge.tsx`：`ShortcutBadge` 与 `KeySequenceBadge` 的 `key={index}` 改为 ``key={`${label}-${index}`}``，既保持重复键唯一，也不再依赖数组下标作为标识（`no-array-index-as-key` ×2）。
- 默认值稳定性：`dropdowns/layout.tsx` 的 `disabledLayouts = []` 与 `list-group.tsx` 的 `groupIssueIds = []` 改为模块级共享空数组（`EMPTY_LAYOUTS` / `EMPTY_ISSUE_IDS`）。默认参数里的数组字面量每次渲染都是新引用，会让 `useMemo` 依赖失效、也会让 `observer` 的浅比较失效（`rerender-memo-with-default-value` ×2）。两处均只读使用，共享常量无被写入风险。

合计消除 6 条诊断（1 条 error + 5 条 warning），另附带消除 `js-hoist-intl` 1 条。

## 本轮核实的误报（附证据）

这些诊断在当前代码里没有可修的真实缺陷，逐条读过实现：

- **`effect-needs-cleanup` 5 条（全部是剩余 error）**：`use-responsive-tab-layout.ts:76`（callback ref 内 `observe`，node 变更与卸载时 `disconnect`）、`resizable-sidebar.tsx:125`（`setTimeout` 存入 ref，卸载 effect 与各交互路径 `clearTimeout`）、`smooth-cursor.tsx:8`（effect 返回的 cleanup 里 `editor.off` + 5 个 `removeEventListener` + `caret.remove()`）、`ai-handle.ts:113` 与 `drag-handle.ts:252`（Tiptap `createView` 返回的 `destroy` 中逐个 `removeEventListener`）。清理路径都在，规则无法跨函数追踪 ref / destroy。
- **`no-loading-flag-reset-outside-finally` 5 条**：`writing-assistant.tsx:71`、`estimates/create/modal.tsx:87`、`impact-dialog.tsx:95`、`workflow-metadata.tsx:108`、`use-infinite-options.ts:95` —— 五处的 `setBusy/setSaving/setIsLoading(false)` 都已位于 `finally` 内，外层条件（`controller.current === current`、`generation === generationRef.current`）正是刻意保留的会话隔离，避免陈旧请求清掉新会话的 loading。
- **`rendering-hydration-*` 13 条**：web 为 `ssr: false`，不存在服务端渲染与 hydration 比对；`new Date()` 在 JSX 中每次渲染取新值，在纯客户端渲染下没有水合风险。
- **`no-unused-vars` 7 条、`async-await-in-loop` 4 条**：全部位于 `apps/web/public/sw.js` 与 `public/workbox-*.js`，是 workbox 生成的 Service Worker 产物，不应手改。
- **`no-static-element-interactions` 4 条**：编辑器容器、图片 block、全屏弹窗遮罩与甘特拖拽层，它们带 `onClick` 但不是可交互控件；补 `role`/`tabIndex` 会与 contenteditable 语义冲突。
- **`no-autofocus` 4 条、`rendering-hydration-no-flicker` 3 条、`no-derived-state` 3 条、`no-adjust-state-on-prop-change` 5 条**：分别对应产品意图（链接输入自动聚焦）、弹窗打开/关闭动画所需的「先以关闭态提交再打开」时序（`impact-dialog`、`workflow-metadata` 与工作区弹窗同一模式）、以及 prop 初始化后仍可被用户改写的表单状态。改动会牺牲动画或改变首帧时序，收益低于风险。

## 未修的结构性类别与理由

剩余 338 条中，约 250 条集中在需要跨文件重构的规则上，本轮不动：

- `no-high-complexity-react-function` 90 条（88 个文件，复杂度 15–27）：集中在 issues、auth、instance setup 等核心组件，拆分需要逐个重写分支与 JSX，回归面远大于收益。
- `js-set-map-lookups` 70 条：上一轮的合成测量显示，5 项/2 选中时 Set 反而更慢，20/5 基本持平，约 100/25 起才明显更快；筛选下拉的已选集合通常只有个位数，机械替换没有真实收益。
- `only-export-components` 49 条（`layout.tsx` 12 条）与 `no-giant-component` 14 条：都需要拆分文件/组件，属于开发体验类重构。
- `duplicate-jsx-subtree` 17 条、`no-pass-data-to-parent` 14 条、`prefer-dynamic-import` 17 条：跨文件抽象与页面级懒加载（`recharts`、`@react-pdf/renderer`），正确做法在消费侧而非组件内部 `React.lazy`，属架构调整。

保留的唯一常规 lint warning 仍是 `packages/blocks/src/virtual-list/virtual-list.tsx` 的 TanStack Virtual `incompatible-library`：构建未启用 React Compiler，稳定可变的 virtualizer 实例确实不兼容自动记忆化，包装或移入 ref 都不修复契约。

## 验证记录

- 类型检查 27 任务、lint 16 任务、格式 16 任务全部通过（`pnpm check:types` / `check:lint` / `check:format`）。
- Web 全量：343 文件 / 1634 项通过；Editor 全量：12 文件 / 54 项通过。
- Ego 浏览器（TaskSpace113，真实组件 + mock store/延迟服务，非完整后端链路）：
  - 链接会话：同范围 URL 更新后预览刷新为 `https://new.example`；`mouseleave`（`relatedTarget=null`）在 250ms 仍打开、650ms 后关闭；IME 回车与 `keyCode 229` 均不提交，普通回车恰好提交 1 次。
  - 删除弹窗：提交中显示 `deleting`，成功关闭并提示；失败保持可重试；未授权走权限提示；**pending 期间关闭并重开后，旧请求完成不影响新会话**（弹窗仍开、按钮恢复、无重复 toast）。
  - 项目创建：关闭后 100ms 重开时表单已重置；陈旧请求 resolve 不关闭新会话；切换工作区后会话重置；失败保留输入可重试。
  - 密码表单：显隐切换只影响自身输入框且带 `aria-controls`；合法密码的强度提示聚焦显示、失焦隐藏；确认内容短于原密码时聚焦隐藏、失焦提示；CSRF 拒绝后表单仍可用、恢复后 token 正常写入。
  - 图片尺寸：`35%` 初始化为 245px/123px（容器 700、宽高比 2）；键盘 +10、连按不丢步、Shift +50；右对齐方向反转；拖拽中仅 draft 变化、松手才提交；窗口失焦取消且不写入。

## 后续建议

1. 剩余 5 条 Doctor error 均为 `effect-needs-cleanup` 误报，若希望分数反映实情，可考虑向 React Doctor 反馈该规则对 ref/`destroy` 清理路径的识别缺口，而不是在源码里加注释规避。
2. 若要继续降分，建议按「单文件、可回归」的顺序做 `duplicate-jsx-subtree` 与 `prefer-dynamic-import` 中的具体项，而不是批量拆组件。
3. 本轮所有改动仍留在工作区，未提交、未推送；`apps/web/.temp/round7-*-preview` 与 `.claude/launch.json` 中的 `round7-*` 条目为本地验证用，可按需清理。
