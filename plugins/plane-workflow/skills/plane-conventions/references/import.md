# 批量导入、归档去重与原生依赖

每次调用显式传 `workspace_slug`。先确认工作区和项目，所有写入沿用已明确授权的范围；删除与批量归档须确认具体清单。以下动作需要支持该能力的服务端，旧连接未加载时先更新插件并重新连接，不能用描述文本冒充原生关系。

## 导入前完整去重

- `workitem(action="list", workspace_slug="<slug>", project="WEB")` 只列未归档工作项，按 `next_cursor` 连续分页。
- `workitem(action="archived", workspace_slug="<slug>", project="WEB")` 独立列已归档工作项，包含子任务、稳定 UUID、parent 与 archived_at，同样按 cursor 分页。
- 普通列表没有下一页不代表已覆盖归档。任一分页失败或权限受限时标注实际范围，不宣称完成全量去重。
- 已知 UUID 可用 `workitem(action="get", workspace_slug="<slug>", project="WEB", work_item="<UUID>", include_archived=true)` 回读归档；指定 project 会验证归属，不能跨工作区定位。

## 稳定 ID 幂等写入

为本次来源固定 `external_source`（例如 `web-eq-2`），为每项固定 `external_id`（对应导入清单 local_id），不要把描述文本搜索作为唯一身份依据。

- 精确查重：`workitem(action="get_by_external_id", workspace_slug="<slug>", project="WEB", external_source="web-eq-2", external_id="WEQ2-17")` 返回单个对象，包含归档和子任务；未命中报错，多个匹配报冲突。
- 单项：`workitem(action="upsert", workspace_slug="<slug>", project="WEB", external_source="web-eq-2", external_id="WEQ2-17", name="实现功能")`；创建必须有 name，更新可省略未修改字段。命中归档保持归档，不隐式恢复。
- 批量：`workitem(action="bulk_upsert", workspace_slug="<slug>", project="WEB", external_source="web-eq-2", items=[{"external_id":"WEQ2-17","name":"实现功能"}])`，每批 1–100 项，各项 external_id 批内唯一。每项支持工作项创建/更新字段。

批量非整批事务，结果逐项为 `succeeded`、`failed` 或 `unknown`，必须保存成功项 UUID 和失败原因。请求中断、服务端错误或 unknown 时先按稳定外部 ID 回读核验，禁止改用 create 重试导致重复。同一来源和外部 ID 的并发写入由服务端串行处理；历史重复冲突需明确解决，不自动挑选。

父子项分两阶段：先幂等创建所有工作项、保存 local_id → UUID，再用 parent 或 add_sub_items 建层级；依赖关系在工作项均存在后写入。批量不同项可独立继续，失败项的父子或依赖步骤必须暂停。

## 原生依赖方向

`workitem(action="relations", workspace_slug="<slug>", work_item="WEB-1")` 返回当前项视角的关系：

- `blocks`：当前项阻塞目标。A blocks B 表示 A 必须先完成，B 被 A 阻塞。
- `blocked_by`：当前项被目标阻塞。B blocked_by A 与 A blocks B 为同一关系。

新增：`workitem(action="add_relation", workspace_slug="<slug>", work_item="WEB-1", relation_type="blocks", related_items=["WEB-2"])`。

移除：`workitem(action="remove_relation", workspace_slug="<slug>", work_item="WEB-1", relation_type="blocks", related_items=["WEB-2"])`。

重复新增与移除幂等，动作返回回读关系；完成后从两端核对方向。不存在、跨工作区或不可见目标必须报错，不能静默跳过或绕过权限。依赖不是父子关系，也不是描述中的链接。

## 模块负责人和统计

创建或更新 module 可传 `lead="me"`、成员邮箱/名称/UUID；`members=["me"]` 设置模块成员。更新时省略保留，`lead=null` 或空字符串清空负责人，`members=[]` 清空成员，非空数组全量替换；写后用 module.get 回读。负责人和成员必须是有效项目成员。

模块状态计数按工作项 UUID 去重，排除软删除、归档、草稿和 triage，含子任务。比较 module.items 时必须读完分页，不能只看第一页。多人负责人不应导致模块工作项重复计数。

## Markdown 与稳定 ID

正文和评论支持 `- [ ]` / `- [x]`，会保存为编辑器可识别的 taskList/taskItem HTML，回读保留选中状态。`WEQ2-17` 等标识内部连字符保持原样；其余 Markdown 转义用于保留原始文本语义，不应盲目去掉反斜杠。稳定身份仍使用 external_source/external_id 字段，而非依赖 Markdown 的展示字符串。
