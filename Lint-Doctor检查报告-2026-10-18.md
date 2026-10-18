# Lint 与 React Doctor 检查结果 · 2026-10-18

开始时 preview 无未提交代码，只有既有未跟踪研究文档。本轮修改留在工作区，未暂存、未提交、未推送。

- Oxlint：412 → 7 warnings，0 errors；Ruff：1 → 0。
- Doctor 0.9.18，schema 3，full 全10项目完整覆盖：51 → 58 分；642 → 514 诊断（16 → 6 errors，626 → 508 warnings）。
- 所有分数使用同一版本、项目、scope与默认类别选择。

| 项目            | 初始 | 最终 |
| --------------- | ---: | ---: |
| apps/admin      |   75 |   78 |
| apps/live       |   71 |   75 |
| apps/space      |   62 |   86 |
| apps/web        |   62 |   65 |
| packages/blocks |   80 |   83 |
| packages/editor |   51 |   58 |
| packages/hooks  |  100 |  100 |
| packages/i18n   |  100 |  100 |
| packages/types  |  100 |  100 |
| packages/utils  |   75 |   89 |

## 验证

- 全仓库 check:lint、check:format、check:types 和后端 Ruff 均通过。
- Web完整低并发运行292文件1430测试通过，两组构建并行时导入失败；构建完成后单独补跑2文件14测试通过。
- blocks：46文件392测试通过；editor：5文件17测试通过；live：5文件44测试通过。
- 增量Doctor报告0 errors、1 warning：editor-container click-events-have-key-events。HEAD同一行已有onClick且无onKeyDown，属于既有交互，被扫描器差异匹配列为新增，未宣称增量完全无告警。
- Ego实际打开127.0.0.1:3000和3110均显示Plane启动异常，后端实例不可用，未完成登录后交互验证。

## 保留项

初次检查保留7条lint：blocks Portal布局effect挂载同步1、TanStack Virtual编译器兼容提示1；editor容器指针增强2、图片块指针增强1、全屏图片dialog与拖动语义2。

提交前，严格pre-commit要求暂存文件零warning。editor的5条既有语义例外使用附具体原因的行级抑制：键盘编辑由ProseMirror负责，图片拖动是坐标指针增强，现有dialog结构保留层级与焦点约定。没有将React事件改成原生监听器或增加无实际行为的按钮。blocks两条告警保留，未关闭全局规则。

6条Doctor errors经代码核实：固定日期星期key1、已有清理的Web观察器与定时器2、已有清理的editor订阅和插件destroy3。未添加抑制。其余复杂度、架构与性能建议需要独立评估。

reflect-metadata确需副作用执行，规则仅精确allow该包，保留其余未赋值导入检查。没有通过更换Doctor版本或收窄类别提高分数。
