# Lint / Doctor 第六轮修复

本轮基于 `fix/lint-doctor-cleanup` 工作区，未提交、未推送。未修改扫描配置、规则或依赖。

## 固定口径结果

React Doctor 0.9.18，schema 3，`--scope full --json --blocking none --yes`，全部10项目 complete=true，skippedChecks=[]。

| 检查               | 修复前 | 修复后 |
| ------------------ | ------ | ------ |
| 常规 lint errors   | 0      | 0      |
| 常规 lint warnings | 2      | 1      |
| Doctor errors      | 6      | 6      |
| Doctor warnings    | 371    | 354    |
| Doctor 总诊断      | 377    | 360    |
| Doctor 总分        | 61     | 61     |
| Blocks 分数        | 83     | 84     |

相对 HEAD 的 changed 扫描包含未跟踪源码：0 errors / 0 warnings。该扫描的分数不与 full 分数比较。

## 修复内容

- 收藏：MobX `toJS` 生成独立快照，保留嵌套 observable 更新与 undefined；为父子归组建立索引；批量ID一次去重，保留首次ID顺序和末次响应数据。5项测试覆盖重复、独立性、原地更新、空响应/失败和乐观更新回滚。
- Portal：提交阶段生命周期管理容器；真实所有权与引用计数替代 DOM 标记推测；微任务等待子节点提交结束再清理，仅对仍有外部子节点的空闲目标容器设置局部 observer。保留 SSR/hydration、StrictMode、多实例、切ID、回调语义与外部容器。13项Portal/Modal定向测试通过。
- 成员筛选：六处相同概念的列表共享 MemberFilter；移除只依赖搜索的缓存，跟踪 MobX 原地成员与选中变化；Set复用选中查找。18项回归通过。
- 项目分组：状态、标签与阶段索引，保留重复配置的 first/all-match、配置/项目顺序、空组与未分配逻辑。12项回归通过。
- 图表数据：自有属性检查替代每行重复键数组扫描，保留已有0/null/undefined和额外字段、不修改输入。3项回归通过。
- 图片恢复：单独hook负责请求去重和源/卸载会话保护，旧restore或触屏URL刷新不再覆盖新图片。新增5项回归，editor全量36项通过。

## 性能证据边界

合成函数测量，不代表真实页面延迟或生产负载：

- 收藏500条observable分组：中位数1.806→1.108ms；曾尝试cloneDeep但测得回退，已弃用。
- 项目10000条，81状态/121标签配置：状态1.027→0.142ms，标签6.446→0.887ms，阶段1.912→0.507ms，新旧输出deepEqual。
- 图表1000行/200列缺失字段查找：16.29→3.80ms；仅测查找步骤。

## 浏览器与检查

Ego TaskSpace112使用真实Portal、MemberFilter、图片恢复hook，mock store/延迟服务；验证共享清理、切ID/外部移除、原地成员加载/选择/搜索/展开/ID回调、重复恢复和切源/卸载保护。已finish。并非完整登录/后端链路验证。

全仓库类型27任务、lint16任务、格式16任务通过。修复前Web全量333文件/1567项通过；最终Web全量336文件/1598项通过。Editor最终全量9文件/36项通过。Blocks全量默认并发及maxWorkers=2均停留在启动输出，已中止，未得到全量结论；本次受影响Portal/Modal的13项定向测试通过。jsdom canvas未实现与TimeoutNaN提示在修复前已存在。

## 保留及后续

- 唯一常规lint warning：`packages/blocks/src/virtual-list/virtual-list.tsx` TanStack Virtual `incompatible-library`。构建未启用React Compiler；稳定可变virtualizer实例确实不兼容自动记忆化模型。简单包装或移入ref不修复合同，需要依赖兼容方案或完整快照适配和滚动测量回归。
- 6条Doctor errors沿用交接已核实情况，未通过禁用规则消除。
- 图片block仍有尺寸初始化/拖拽的complexity与giant提示；恢复逻辑已修复，后续可以独立评估尺寸生命周期职责。
- 剩余360条不是全部已确认bug；继续逐项证明，不机械Set化固定小集合、不移动公开导出刷分、不引入关键UI加载闪动。
