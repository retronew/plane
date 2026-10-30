# 编辑器对比与迁移评估

对比入口：开发服务器 `/editor-comparison/`，仅 development 注册。以下原型矩阵记录早期验证，不代表正式入口当前状态。

## 正式迁移状态（2026-10-29）

Web/Space 编辑适配层现使用共享 `@plane/editor/plate`。工作项详情、侧栏详情和 Intake 描述接入独立 Yjs 协同；页面正文与标题共享同一 Y.Doc。评论、创建表单、模板、项目描述和 Sticky 保留原保存语义。格式工具栏默认浮动，提交、附件等业务操作栏保留。

API 使用独立 IssueDescriptionDocument/PageDescriptionDocument，保留旧 ProseMirror 数据。迁移为 0163–0165；API/live 必须配置相同的 LIVE_SERVER_SECRET_KEY。HTML 是搜索、历史、通知与导出的投影。外部整段替换递增 epoch，旧会话禁止覆盖新内容。跨实例传播通过 CAS 和约两秒轮询，同实例使用 WebSocket 实时同步。

本地迁移已执行，正式 live 在 3100 启动。父流程回归：共享编辑器 82 项、live 86 项通过。此前原型的双客户端同步、局部撤销、上传、刷新、服务重启和头像光标已通过 Ego 验证；这些是同账号两个客户端，不能替代正式入口多账号验收。后续经用户授权新建 Ego 空间 27，正式工作项 TEST-8 已验证双客户端输入同步、刷新持久化、新建描述及评论提交/刷新。正式页面已验证标题/正文双客户端同步与刷新。修复真实首页 Sticky assets/ref 无限更新；live 本地配置补齐 CORS_ALLOWED_ORIGINS。按用户澄清保留原页面顶部工具栏，移除新增 +/链接常驻栏、连接状态文字和在线头像组，只显示远端光标头像；恢复无边框标题、与标题对齐的正文限宽及原 placeholder。恢复样式后标题协同复测通过，新增回归20项通过，Doctor98。浏览器为同账号双客户端；Intake、公开Space、模板、导出及多账号权限尚未完成浏览器验收。

待验收入口：工作项完整详情/侧栏详情/Intake、页面正文与标题及历史恢复、工作项评论、新建工作项和模板、项目描述与 Sticky、公开 Space。尚未对所有入口宣称端到端通过。

## Slash 与空白聚焦回归（2026-10-30）

- 正式 Plate 输入 `/` 显示原样式分组菜单；中文/英文过滤、方向键、Enter 插入、Esc 关闭，不新增常驻操作栏。
- 文档下方留白属于 contenteditable，点击内容下方定位末尾；评论高度保持原样。Ego 实测正文高度从48px扩大到554px，关闭全宽后标题/正文均720px。
- 修复 Plate `tf.apply` 绕过 Yjs `editor.apply` 导致删除不进入协同文档的问题。真实双端验证全文替换、触发词删除、表格插入及刷新均保留正确结果。
- 验收页面：`/test/projects/f426251c-a887-4b75-9152-55a6ee1c8835/pages/c3d80e7f-65c5-43b0-a8cf-ca6b7da1c378/`；工作项：`/test/browse/TEST-8/`。

## 功能与验证矩阵（2026-10-29）

| 能力                            | 对比页实现                                         | 验证与边界                                                                               |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 基础文字、H1–H6、引用、行内代码 | Plate 插件、保留旧编辑器                           | 单测覆盖语义 HTML；ego 验证输入、粗体、撤销重做                                          |
| 列表与待办                      | 平铺节点导入，导出重建嵌套列表                     | 单测覆盖嵌套/混合列表、起始编号；ego 双向转换保留 start=3、分组及 checked                |
| 表格                            | 插入、增删行列、删除                               | 单测验证变换，ego 验证斜杠菜单插入 3×3；ego 验证 2×2 合并拆分；官方 hooks 列宽拖动已验证 |
| 图片                            | 隔离上传、宽度、对齐、说明、预览链接、删除         | ego 验证上传、240px、居中、说明、双向转换、删除撤销；不写真实附件                        |
| 提及                            | 两名演示成员，业务 HTML 标签                       | 单测及 ego 验证 entity_identifier/entity_name；未连接工作区成员与通知                    |
| 提示块                          | 自定义节点及业务属性                               | 单测、ego 双向转换；图标与背景编辑尚未等价                                               |
| 链接、颜色、高亮、对齐          | 插件与工具栏                                       | 单测 HTML 往返；每种菜单组合未逐项浏览器覆盖                                             |
| 代码块                          | 多行编辑、HTML 往返                                | 单测；语言元数据与空行往返已覆盖；官方 CodeBlockPlugin + lowlight 语法高亮已验证         |
| Markdown                        | 显式导入 Plate                                     | ego 验证标题、格式、列表、代码；不是全量无损 Markdown 往返                               |
| 斜杠菜单                        | 空块输入 /，或按钮打开                             | ego 验证菜单和表格插入；尚无命令搜索                                                     |
| 表情                            | 复用项目 EmojiPicker                               | ego 验证中文搜索火箭并插入；图标页不作为文本节点插入                                     |
| 字体与排版                      | 原 editor-container 变量、标题段落类、局部适配 CSS | ego 对照标题/段落字号行高及大号等宽字体；尚非逐像素一致                                  |
| 实时多人编辑                    | 未接入                                             | 两侧不共享协同房间                                                                       |

## 已发现的兼容性边界

- Plate 的列表模型是一项一个段落，旧单个 li 内多段内容可能被合并。
- 普通块 data-id、完整表格属性仍需专门迁移契约；当前不能据此批量替换生产 HTML。
- 图片是会话内 UUID 与 object URL 映射。页面卸载统一释放 URL；删除软标记，以保持另一侧和 undo 可用。未验证真实上传权限、失败重试、资产复制、清理与后端通知。
- 旧编辑器图片独立上传菜单、拖放/粘贴图片、预览新窗口、移动端/IME 组合输入还未完成端到端覆盖。
- 不支持的业务节点（附件、嵌入等）不能默认安全往返；未覆盖后端 sanitizer 和所有 HTML 消费者。
- 工具栏已按官方示例改为紧凑图标与 tooltip；尚未接入官网案例中的 AI、评论、建议和公式等业务能力。

## 多人编辑结论

当前任务描述使用整段 HTML 防抖保存，没有实时协同合并；并发保存可能后写覆盖。已有页面文档使用 Yjs/Hocuspocus，但 live 文档类型为 project_page，不能直接套用为任务描述。Plate 的 Slate/Yjs 数据格式也不能直接复用 ProseMirror/Yjs 二进制。

生产迁移应单独定义任务协同文档类型、房间权限、初始化与持久化、HTML 派生输出和旧内容导入；明确保留旧客户端时的写入策略。也应独立评估服务端乐观锁，以降低非协同整段保存覆盖风险。

## 自动检查

- `pnpm --dir apps/web test components/editor/comparison`：7 文件，43 测试通过。
- 限定 OxLint：通过。
- React Doctor changed：98/100；13 条维护性警告，无错误。
- web 全局 TypeScript：未通过，存在既有 admin 跨项目引用、通知测试类型问题；最终检查确认本次 comparison 文件无类型错误。

所有交互检查使用 ego；此页未提交、未切换生产任务详情。

## 交互补齐

- 块拖拽使用官方 `@platejs/dnd` 的 DndPlugin、useDraggable 和 useDropLine；移除自写原生拖拽逻辑。
- 选区菜单使用官方 `@platejs/floating` hooks；按钮复用 Propel，ego 验证选区格式操作。
- 表格上下文菜单调用官方增删行列与合并拆分 transforms，ego 验证。
- 代码块只保留 `CodeBlockPlugin + lowlight` 基础高亮，搭配局部作用域 GitHub Light/Dark 主题，不显示语言选择和复制控件。语言元数据继续参与高亮及 HTML 往返。行内代码沿用原编辑器样式。
- 固定栏与浮动栏复用 `SelectionToolbarControls`：按官方 registry 的分组、Lucide 图标、tooltip 和 pressed 状态适配 Propel。项目按钮为 28px（官方默认 32px），图标 16px；块类型保留文字下拉。参考 [floating-toolbar-buttons](https://github.com/udecode/plate/blob/v53.5.1/apps/www/src/registry/ui/floating-toolbar-buttons.tsx)、[fixed-toolbar-buttons](https://github.com/udecode/plate/blob/v53.5.1/apps/www/src/registry/ui/fixed-toolbar-buttons.tsx) 和 [toolbar](https://github.com/udecode/plate/blob/v53.5.1/apps/www/src/registry/ui/toolbar.tsx)。
- 颜色复用完整 ColorSwatchPicker，含预设、连续色板、hex、文档已用颜色及清除。ego 验证 tooltip、hex 颜色、链接应用、标题转换和对齐；单测覆盖链接编辑/取消/移除、文字与背景色独立清除。
- 默认及完整样例内置同源 SVG 图片和稳定资产 ID，ego 验证两侧加载与往返；上传图片仍使用会话 object URL。
- 图片继承 `@platejs/media` 的 `BaseImagePlugin`，复用 `useMediaState` 与官方 `ResizableProvider/Resizable/ResizeHandle`。点击选中后显示编辑区，预览为独立按钮；ego 验证240px→300px拖动、居中、说明输入焦点、点击正文隐藏编辑区。为保留资产ID契约，未接官方URL输入及默认粘贴上传；无裁剪/滤镜。
- 表格右侧整条添加列、底部整条添加行；首列左侧与首行上侧分别提供行/列三点菜单，hover 显示，打开菜单时保持可见。菜单复用 Propel 多层 Menu，行/列操作分组，保留合并拆分和删除。左侧滚动容器至少留 12px，ego 实测行按钮完整位于裁切范围内（边缘留 4px）且边缘命中；多层菜单插入行已验证。

- 表格改为行列边缘 hover 添加按钮，合并/拆分/删除收进更多菜单。官方 resizable hooks 实测列宽 160px → 220px。菜单保留选区，2×2 合并拆分端到端通过。
- 拖拽手柄为 16×16 IconButton，依据实际图片、表格、代码块或文字首行位置测量，跟随图片缩放/对齐。ego 验证右对齐 240px 图片的手柄位于图片左侧 20px、顶部 6px。额外 drop gap 命中区覆盖相邻块折叠 margin，保留官方 DnD 行为。
- 图片浮动栏以实际 img 为锚点，ego 实测正常视口间距约 6px，空间不足时翻转或避让。宽度输入纯数字会转换为 px，已补回归测试。
- 引用块使用原编辑器的 `margin-block: 1.6em`，并按实际顶层块顺序修正拖拽 wrapper 导致的段落 first/last-child 间距偏差。ego 实测样例中两侧引用文字距前段末行均 31.68px、距后续标题均 55.68px；后续标题自身的顶部留白保持不变。
