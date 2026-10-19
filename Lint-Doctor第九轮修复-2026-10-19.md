# Lint / Doctor 第九轮（查找索引与按需加载）

承接第八轮，分支 `fix/lint-doctor-cleanup` 已推送。未修改扫描配置、未禁用规则、未改动依赖版本。

## 固定口径结果

React Doctor 0.9.18，schema 3，`--scope full --json --blocking none --yes`，全部 10 个项目 `complete=true`。

| 检查               | 第八轮结束 | 现在 |
| ------------------ | ---------- | ---- |
| Doctor errors      | 5          | 5    |
| Doctor warnings    | 305        | 203  |
| Doctor 总诊断      | 310        | 208  |
| 常规 lint warnings | 1          | 1    |

项目分数：**space 87 → 91**、**@plane/utils 89 → 100**、**admin 91 → 92**、web 73、blocks 84、editor 61、live 75。`--scope changed` 扫描：0 诊断。

规则分布变化：`js-set-map-lookups` **68 → 0**、`no-giant-component` **14 → 1**、`only-export-components` **49 → 33**，`prefer-dynamic-import` 17 → 16（实现文件仍静态导入，但消费侧已拆分 chunk）。

## 一、数组查找索引（68 处 / 61 个文件）

每个被报告的位置都把「循环内重复 `includes`」改为循环外建一次 `Set`/`Map`：

- 筛选面板：`appliedFilters?.includes(x)` → `appliedFilterSet.has(x)`，`Boolean(...)` 包裹一并去掉（`has` 已返回布尔）。
- `packages/utils` 的四个筛选判定函数：`const statusSet = new Set(filter.status)` 后 `statusSet.has(...)`，`new Set(undefined)` 与原先的可选链同为 falsy。
- 4 处「循环内 toggle」保持语义不变：`newValuesSet` 与正在原地增删的数组同步（`push/add`、`splice/delete`），因此重复值、顺序与切换行为都与原实现一致。
- inbox 的 6 个筛选器：`inboxFilters?.[k] || []` 每次渲染都是新数组，直接 `useMemo` 会触发 `exhaustive-deps`，因此先取出 `rawFilterValue` 再按它 memo 化。

项目里 MobX `observer` 组件有意不对 observable 数组做 memo（`member-filter.tsx` 的注释即说明这一点，且 `filter-selection.tsx` 会原地修改数组），所以这些位置统一用「每次渲染重建 Set」而不是 `useMemo`——否则 memo 会因数组引用不变而失效。

## 二、按需加载（图表与 PDF）

- `export-page-modal.tsx`：`@react-pdf/renderer` 与 `PDFDocument` 改为点击导出时 `Promise.all([import(...)])`，导出按钮已有 loading 态。
- web 中所有 recharts 消费点改为 `React.lazy` + `Suspense`，fallback 复用已有 `ChartLoader` / 占位：`created-vs-resolved`、`project-comparison`（含 blocks 的 `BarChart`）、`details`、`cycle-card`、`priority-distribution`、`state-distribution`、`progress-chart`。
- 相关测试改为 `findBy*` 等待懒加载模块（`cycle-card`、`overview`），并补上 `@plane/i18n` mock 的 `getCurrentLanguage`（`getDateTimeFormatter` 需要）。

`apps/live` 的 4 条 `prefer-dynamic-import` 未改：那是服务端导出服务（`services/pdf-export`），不进入浏览器 bundle，规则不适用。

## 三、状态与显示

- `AuthRoot` 不再把 `authMode` prop 复制进 state：`authMode = override ?? currentAuthMode`，登录表单在首帧就渲染（原先首帧空白等 effect）。新增 `auth-root.test.tsx` 断言首帧即渲染并跟随 prop。
- 工作流运行/版本时间戳改用共享缓存的 `getDateTimeFormatter`，与产品其他日期一致跟随应用语言（原先 `toLocaleString()` 用浏览器 locale）；对应测试 mock 补 `getCurrentLanguage`。

## 四、验证

- 全仓 `pnpm check`（format 16 / lint 16 / types 27）通过。
- Web 全量 **345 文件 / 1638 项**、Editor 全量 **12 文件 / 54 项**、blocks 定向 4 项通过。
- 每批提交前 `doctor --scope changed` 均为 0 诊断。

## 五、仍保留的类别与理由

| 规则                                                             | 数量 | 不处理的原因                                                                                              |
| ---------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| `no-high-complexity-react-function`                              | 90   | 复杂度来自核心业务分支（issues/auth/instance），拆分需要逐个重写控制流，回归面大                          |
| `only-export-components`                                         | 49   | 绝大多数是 React Router 的 `meta`/`layout` 路由约定（框架要求与组件同文件导出），不是可拆的普通模块       |
| `prefer-dynamic-import`                                          | 16   | 已按需拆分实际 chunk；剩余是图表/PDF 的**实现文件**，同步渲染必须静态导入                                 |
| `no-giant-component`                                             | 14   | 6 个是自动生成的 SVG 插画（拆层只搬 path，不提升可读性）；其余组件的 JSX 与状态内聚，拆分需传递 10+ props |
| `no-unused-vars` / `async-await-in-loop`                         | 11   | workbox / `sw.js` 构建产物                                                                                |
| `rendering-hydration-*`                                          | 10   | web 为 `ssr: false`，无水合比对                                                                           |
| `effect-needs-cleanup` / `no-loading-flag-reset-outside-finally` | 10   | 清理路径在 ref/`destroy`/`finally` 中，规则无法跨函数追踪                                                 |
| 其余可访问性/状态规则                                            | ~20  | 编辑器容器、弹窗动画时序、公共 API 设计等已在上两轮逐条说明                                               |

## 数据库

本轮同样没有任何模型、迁移或 `apps/api` 改动，无需执行迁移或同步线上环境。

## 六、大组件拆分（`no-giant-component` 14 → 1）

- **7 个 empty-state SVG 插画**：按视觉层拆成 `BackgroundLayers` / `ShadowLayers` / `ForegroundLayers` / `DetailLayers` 四个同文件组件。新增 `vertical-stack.test.tsx`，逐张断言 path 数量（51/46/48/58/59/47/49）与两个 opacity 分组不变；首版脚本漏掉了 `view` 中位于第一个分组之前的 2 条 path，测试当场发现并修正。
- **6 个业务组件**（顶层组件行数）：`TemplateEditor` 497→241、`CategoryManager` 484→254、`UpdateDiscussion` 402→270、`WorkflowRunner` 405→271、`ProjectDetailsForm` 430→196、`InstanceAIForm` 307→249。拆出的都是同文件具名组件（`TemplateMultiSelect`、`CategoryRow`、`UpdateCommentRow`、`WorkflowTestPanel`、`ProjectCoverHeader`、`AIProviderField` 等），state 与 handlers 留在原组件，JSX 区块通过 props 接入；key、i18n 文案、class 与事件处理保持不变。
- 验证：Web 全量 **345 文件 / 1638 项**、settings 77 项、project 221 项、workflow+project 387 项全部通过；admin 类型检查通过。

**保留 1 个**：`packages/blocks/src/select/root.tsx`（`SelectRoot`，643 行）。其中约 580 行是逻辑而非 JSX，open/selection/search/infinite 四组状态相互耦合，源码注释记录了这些不变量（例如关闭时不能重跑搜索、infinite 列表关闭后仍需解析已选 id）。拆成 hooks 需要 10+ 参数来回传递并打散这些不变量，可读性反而下降，因此保留。

## 七、组件文件的非组件导出（`only-export-components` 49 → 33）

把 13 个值/工具导出从组件文件移到独立模块，组件文件只导出组件（Fast Refresh 才能保留状态）：

| 模块                                                     | 移出的内容                                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `common/boot-loader-state.ts`                            | 启动引导的模块状态、`finishBoot` / `scheduleBootFinish`，以及新拆出的 `holdBootGate` / `releaseBootGate`（导入的绑定只读，计数改成成对函数） |
| `analytics/details-columns.ts`                           | `DETAIL_COLUMNS`                                                                                                                             |
| `analytics/insight-metrics.ts`                           | `InsightMetric` 类型与 `INSIGHT_METRICS`                                                                                                     |
| `analytics/project-completion.ts`                        | `projectCompletion`                                                                                                                          |
| `analytics/select/duration-range.ts`                     | `parseCustomAnalyticsRange`                                                                                                                  |
| `exporter/export-status.ts`                              | `exportStatusLabel`                                                                                                                          |
| `inbox/inbox-status-icon-properties.ts`                  | `ICON_PROPERTIES`                                                                                                                            |
| `editor/sticky-editor/sticky-colors.ts`                  | `STICKY_COLORS_LIST`                                                                                                                         |
| `settings/project/templates/project-template-draft.ts`   | `newProjectTemplate` 与 `Draft`/`ProjectTemplateKind` 类型                                                                                   |
| `settings/workspace/configuration/template-kinds.ts`     | `TEMPLATE_KINDS`、`templateRouteKind`                                                                                                        |
| `settings/workspace/configuration/project-state-keys.ts` | `PROJECT_PHASES`、`stateSettingsKey`                                                                                                         |
| `web-hooks/form/individual-event-options-data.ts`        | `INDIVIDUAL_WEBHOOK_OPTIONS`                                                                                                                 |
| `workflow/history-changes.ts`                            | `memberSnapshotChanges`                                                                                                                      |

验证：相关 56 个测试文件 / 282 项通过，`pnpm check` 全绿，`doctor --scope changed` 0 诊断。

剩余的 33 条中，14 条是 React Router 的路由文件（`meta`/`loader` 必须与组件同文件），其余多是「组件 + 类型导出」或「组件 + 同域 hook」——TypeScript 类型导出在编译期被擦除，不影响 Fast Refresh；hook 与组件同文件是社区常见写法，继续拆只会增加跳转成本。
