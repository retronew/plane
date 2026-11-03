# 同一 Casdoor 应用的多个团队登录入口

Plane 使用同一套 OIDC issuer、client ID、client secret 和回调地址，可为 Casdoor 应用中的多个上游 Provider 显示独立登录按钮。

## 配置

在实例管理后台的「登录方式 → OIDC → 编辑 → 团队登录入口」逐条添加入口。入口标识使用唯一的字母、数字、下划线或连字符；Provider 名称填写 Casdoor 的实际 `provider.name`，允许中文。按钮图标可留空，继承全局 OIDC 图标。

入口配置保存为 `OIDC_LOGIN_ENTRIES` JSON 字符串：

```json
[
  {
    "id": "chengdu",
    "name": "成都水月雨科技飞书",
    "provider_hint": "飞书组织：成都水月雨科技",
    "icon_url": "",
    "enabled": true
  },
  {
    "id": "moondrop",
    "name": "水月雨飞书",
    "provider_hint": "飞书组织：水月雨",
    "icon_url": "",
    "enabled": true
  }
]
```

仅空列表 `[]` 使用原来的单一登录按钮；非空列表中的入口全部关闭时，OIDC 登录入口不可用。公开实例 API 仅返回展示字段，不返回 `provider_hint`。后端只接受已配置且启用的入口 ID，不转发浏览器传入的任意授权参数。

Casdoor 的 `plane` 应用需要同时启用上述两个 Provider 的登录、注册权限。自动账号合并规则应按实际账号策略配置；本次两个 Provider 的 binding rule 均为空。

## 回调地址

沿用同一应用的回调，按环境替换源站：

- Web：`/auth/oidc/callback/`
- Space：`/auth/spaces/oidc/callback/`
- 实例管理后台：`/api/instances/admins/oidc/callback/`

入口 ID 仅用于发起授权。后端将它映射为 Casdoor 的 `provider_hint`，回调由同一个客户端换取令牌。state 有效期为十分钟，按用途与受众区分，并一次性消费。

## 身份与通知

每个 Plane 账号只允许绑定一个 OIDC 身份。现有 `oidc + sub` 关联继续有效；普通登录、管理员登录和缺邮箱验证不能凭同一邮箱给已有绑定的账号增加第二个身份。个人设置中的「更换为」会原子地替换原身份。

两个团队属于同一个 Casdoor issuer，不增加连接命名空间，也不迁移原有 Account 记录。Casdoor 若把两个上游归为同一个 `sub`，Plane 仍将其视为同一身份。

飞书通知保持单一飞书 App 配置。新增登录入口不改变通知接收人、目录同步或飞书身份 metadata。

## 验收

- 两个按钮分别进入正确飞书应用；原团队用户继续进入原 Plane 账号。
- 未知、禁用或缺失的入口（非空入口配置）被拒绝。
- 不同身份尝试关联同一已有账号时提示已绑定其他身份。
- 管理后台和 Space 使用自己的回调。
- 多标签页顺序发起的授权可以交错回调；同一 state 不可重放。完全同时发起请求仍受 Django 整 session 保存的竞争限制。

旧版线上 API 会忽略尚不存在的 `OIDC_LOGIN_ENTRIES` 配置键；HTTP 200 不代表数据已写入。应部署新版后保存并读取该键及公开 `oidc_login_entries` 字段核实。
