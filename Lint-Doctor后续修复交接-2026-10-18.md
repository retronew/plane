# Lint / Doctor 后续修复交接

本轮按用户要求完成第五轮修复、验证后提交，到此停止扩展范围。新 session 从本文及同目录 `Doctor剩余诊断-2026-10-18.json` 开始；JSON 包含全部377条诊断的仓库相对路径、行号、规则及建议。行号会随后续修改变化，先重新扫描再定位。

## 当前结果

第四轮提交 `0a9793bf3b`，68文件。第五轮提交可从本文件所属提交查看（避免在提交内容中写自引用哈希）。分支 `fix/lint-doctor-cleanup`，没有推送。

React Doctor 固定 **0.9.18**、schema 3、full scope、全部10项目、未关闭全局规则。第五轮基线397条（6 errors /391 warnings），最终377条（6 errors /371 warnings），总分59→61，Web69→70，Editor59→61。共享checkout其他会话会提交代码，因此与第四轮报告394条并非完全相同快照；不要混用不同scope或版本的分数。总分受最低分项目影响。

第五轮修复：认证失败恢复和受控CSRF输入；AI上下文异常恢复；描述防抖保存的回调/实体/版本保护；mentions查询乱序及取消；拖放订阅读取最新数据；弹窗Context稳定；估算、模块和Slack会话状态；导出轮询与工作流卸载保护；图片工具栏互斥状态与Escape/拖动退出；周期和顶部搜索键盘入口；状态层批量查询。

## 建议下一轮优先顺序

1. **收藏批量更新**：`apps/web/store/favorite.store.ts:112` JSON序列化克隆，以及相邻children.some循环。只调查未改。先明确数据是否含observable/undefined、逐次push的去重行为、首次匹配和顺序，再用局部对象/数组更新及索引替代；不要直接对MobX对象调用structuredClone。补重复ID、原地observable更新、失败回滚和顺序测试。
2. **大组件与重复JSX**：90条高复杂度、15条大组件、23条重复JSX。按实际职责拆出可测试组件或纯函数，先选拥有充分测试的表单/布局。不要机械拆小函数或拆文件刷分；保留MobX observer追踪和弹窗退出动画。
3. **循环查询**：87条js-set-map-lookups。剩余不少是单次查找或固定小集合，需先证明循环内重复扫描再建Set/Map；保留first-match、重复项、顺序、NaN及MobX语义。utils七处前轮已调查为单次查询，收益不足。
4. **模块边界和加载**：49条only-export-components、17条dynamic import建议。先确认公开API和调用方，再移动真正共享的非组件导出；动态加载需结合bundle和实际首屏测量，不能把关键UI变成额外加载闪动。
5. **编辑器交互**：editor-container、自定义图片拖拽及全屏modal仍有交互/dialog提示。需要完整键盘等价行为与焦点测试，不能把React handlers换native listeners逃避检查、给图片包假按钮或直接改showModal/top-layer。
6. **低优先级状态提示**：默认值初始化、受控select开关、向导autofocus、实时父子状态通知。逐条核对业务合同，保留有必要的初始化和动画挂载。`packages/blocks/src/select/root.tsx` controlled open协调已有详细注释及测试，不能简单删除effect。

## 已核实误报／有意保留项

以下是当前证据，不是永久豁免；新session若改动其逻辑必须重新验证。

| 位置                                                                             | 诊断                             | 保留理由与验证方向                                                                          |
| -------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/web/components/issues/issue-layouts/calendar/week-header.tsx:47`           | no-random-key（error）、Intl相关 | key使用固定日期，不是每次生成随机值。保留原key；若未来支持动态星期列表再评估身份。          |
| `apps/web/components/navigation/use-responsive-tab-layout.ts:76`                 | effect-needs-cleanup（error）    | observer已有disconnect清理，核查真实effect返回路径。                                        |
| `apps/web/components/sidebar/resizable-sidebar.tsx:125`                          | effect-needs-cleanup（error）    | 定时器已有清理；侧栏其他会话也在修改，先读最新实现。                                        |
| `packages/editor/src/components/editors/smooth-cursor.tsx:8`                     | effect-needs-cleanup（error）    | 现有监听/动画有清理。                                                                       |
| `packages/editor/src/plugins/ai-handle.ts:113`、`drag-handle.ts:252`             | effect-needs-cleanup（errors）   | ProseMirror插件destroy已处理生命周期。                                                      |
| `apps/web/components/ai/writing-assistant.tsx:71`                                | loading reset                    | 位于finally内，按当前AbortController身份复位，不能让旧请求清除新请求busy。                  |
| `apps/web/components/estimates/create/modal.tsx:87`                              | loading reset                    | finally内按弹窗会话保护，旧响应不得修改新会话。                                             |
| `apps/web/components/workflow/impact-dialog.tsx:95`、`workflow-metadata.tsx:108` | loading reset                    | finally内仅对仍挂载的会话setState。changed扫描三条新增warning属于此类，测试覆盖卸载和重试。 |
| `packages/blocks/src/select/use-infinite-options.ts:95`                          | loading reset                    | finally按generation保护，防旧请求结束新请求loading。                                        |
| `apps/web/helpers/image-upload.helper.ts:86`                                     | object URL revoke                | 既有finally有revoke，勿删除必要预览。                                                       |
| `apps/web/components/settings/profile/sidebar/item-categories.tsx:67`            | control label                    | SettingsSidebarItem内部原生button已经渲染label。                                            |
| greeting/workflow日期格式等                                                      | hydration / locale render        | Web React Router配置ssr:false；保留用户时区/语言，不能强制UTC或增加挂载闪动。               |
| `apps/web/public/workbox-9f2f79cf.js`、`public/sw.js`                            | await loop / dynamic path        | 生成/第三方service worker代码，先追溯生成工具，不直接手改。                                 |

## Lint 剩余两条

全仓库lint无error，只剩 `packages/blocks` 两条：

- `src/virtual-list/virtual-list.tsx:82` incompatible-library：TanStack Virtual API的React Compiler兼容提示。先确认是否启用Compiler及实际memo跨边界行为，不随意替换虚拟列表。
- `src/portal/portal-wrapper.tsx:57` set-state-in-effect：layout effect挂载portal需要客户端DOM。之前过重的全body MutationObserver重构已撤回，不要重复引入。若整理Portal所有权/共享容器清理，先补多实例、StrictMode、切portalId和外部容器移除测试。

## 验证与环境

- 全仓库类型27任务、lint16任务、格式16任务通过。Web首次全量333文件：332文件/1566项通过，新增Context稳定性测试1项失败。该测试等待schema渲染后，尚有默认值effect更新；改为异步act排空后续状态更新，保留严格引用断言。随后两个受影响测试文件按随机种子1、17、42、734、2026各跑11项，全部通过。未再次运行全量；不能把首次失败抹去或宣称全量全绿。
- 编辑器完整8文件31项测试通过；各分组定向测试已通过。
- Ego真实ActiveCycleStats隔离验证通过：Tab后Enter触发peek及urgent/high过滤；页面明确mock store和子控件。主应用此前因后端instance API不可用，不能宣称完整登录业务链路验证通过。
- 用户要求浏览器验证用Ego，先运行`ego-browser skill`，一目标一个TaskSpace，完成后finish。服务器用preview_start。
- 不高并发跑Web suite，使用maxWorkers=2，避免与workspace包构建同时测试导致dist暂时不存在。

## 接手命令

```bash
pnpm doctor --verbose --scope full --json --blocking none --yes
```

```bash
pnpm doctor --verbose --scope changed --base HEAD --json --blocking none --yes
```

```bash
pnpm check:types
```

```bash
pnpm check:lint
```

```bash
pnpm check:format
```

```bash
pnpm --dir apps/web exec vitest run --maxWorkers=2
```

共享checkout提交前重新检查分支和status，明确暂存所属文件。不要混入其他session修改或未跟踪的功能差异研究文档；不默认推送。用户只要求本轮提交并交接，新session自行确认后续目标。
