# Plane Linux 部署脚本

本目录保留原有的**服务器构建部署**流程，不被本地构建方案替换。另一条已验证的流程见 [本地构建镜像并更新线上 Plane](../docs/local-image-deployment.md)。两种方式共用线上数据、配置和部署锁，同一时刻只能执行一种。

生产服务器现有入口为 `/opt/plane-deploy/deploy-production.sh deploy`，调用服务器专用构建 hook；仓库内的 `deploy.sh` 是通用基础脚本。服务器专用工具位于仓库外，未随 Git 跟踪，修改或重装前应备份。服务器构建所用的 npm 镜像源仅作用于服务器，不改变本地开发配置。切换方式前，确认上一轮成功、实际运行镜像与成功版本标记一致。

适用本机 Docker Compose v2、Bash 4+、Python 3.9+、GNU coreutils/tar、git、curl、flock。默认仓库 `/opt/plane`，分支 `preview`，Compose project `plane`，备份 `/opt/plane-backups`。以能读取配置和 Docker 卷的账号执行（通常 root）。脚本不会连接远程服务器。

```bash
# 建议先把 deploy-artifacts 整个目录复制到服务器仓库外的受信任目录
bash /path/to/deploy-artifacts/deploy.sh plan
bash /path/to/deploy-artifacts/deploy.sh deploy

# 独立清理，先预览，确认后显式执行；部署不会自动清理
bash /path/to/deploy-artifacts/deploy.sh retention
bash /path/to/deploy-artifacts/deploy.sh retention --apply
```

`plan` 只读，不 fetch、不调用 Docker、不创建锁/备份。默认比较本地 HEAD 与已有 `refs/remotes/origin/preview`；可用 `PLANE_REF=<已有远程引用或提交 hash>` 指定目标。`deploy` 会以 120 秒超时、最多三次尝试获取 origin/preview，再锁定目标 hash、检查快进关系。自定义 REF 时仍 fetch preview，但部署指定 REF；应先用 plan 核对。任何 tracked 修改、非 preview 分支或目标开始跟踪服务器环境文件都会拒绝；untracked 文件保留，若与目标冲突由 git 拒绝。

保留根 `.env`、`docker-compose.override.yml`、公共 `/opt/caddy/Caddyfile`；要求 `apps/api/.env` 已是指向根 `.env` 的 symlink。脚本不重写这些文件，不运行 setup.sh。可通过 `PLANE_ROOT`、`PLANE_BACKUPS`、`PLANE_CADDY` 更改路径。服务器 override 必须已经正确配置 `127.0.0.1:8080` 入口及公共 Caddy 到 `https://plane.mdropwork.com` 的转发。

选择规则：仅 `apps/web` 变更只重建 web；共享 packages、锁文件及前端构建配置重建 web/admin/space/live；admin/space/live 单应用变更只重建对应服务；API 变更重建 api/worker/beat-worker/migrator，并运行迁移。Compose、代理、workflow-runner 或其他未分类路径变更拒绝自动部署，需要人工评估。文档等无运行影响的变更只快进、备份及检查入口。

每次记录含配置副本（有密钥，目录权限由 umask 077 保护）、目标/旧提交 manifest、解析后的 Compose、旧/新镜像 ID 与专用保留 tag、数据库及附件。数据库在 plane-db 内使用 PGUSER/PGDATABASE/PGPASSWORD，缺省退回 POSTGRES_*，执行 `pg_dump -Fc` 并用 `pg_restore --list` 校验；附件直接只读归档本机 `plane_uploads` 挂载点并检查 tar，备份均生成 SHA256SUMS。此校验不等于完整恢复演练。旧镜像捕获要求选定常驻服务有现存容器；migrator 从当前 Compose 对应镜像标签解析，不依赖一次性迁移容器。缺少镜像时拒绝继续。

附件是在线备份，写入期间可能产生跨文件不一致；需要严格一致性时，应先人工安排维护窗口并停止附件写入。脚本不做卷快照，也不修改其他业务服务。务必保证备份空间充足，并另行复制备份到异机。

构建默认执行 `docker compose build`。特殊网络可设置 `PLANE_BUILD_HOOK=/绝对/受信任/可执行脚本`，脚本直接调用它，参数依次为仓库路径、锁定 hash、备份记录路径、服务列表；hook 必须返回成功且产出当前 Compose 所需的镜像标签（无显式 image 时为 `plane-服务名`）。hook 具有执行账号的全部权限，需由操作者审核，且不要修改仓库、配置、启动容器或迁移数据库；不预设任何历史备份或网络修补方案。

构建全部成功才更新服务，使用 `up -d --no-build --pull never --no-deps`。API 部署先停止 api/worker/beat-worker，再做第二份数据库备份，随后以无依赖、无拉取/构建方式运行 migrator。健康检查覆盖所选常驻容器的运行/health 状态、本机首页、公共 HTTPS 首页、本机 `/api/instances/`，每轮请求有超时，最多 30 轮。它不能证明所有业务功能均正常，部署后仍应验证登录、工作项操作及附件上传下载。

失败时查看记录中的 `status`、`manifest` 和控制台；尤其 `migrating_schema_may_have_changed` 表示 schema 可能已部分更新。脚本不会自动恢复 schema、代码或服务，API 可能保持停止；先评估迁移结果与数据再人工恢复。旧镜像 tag 用于人工恢复应用版本，不代表旧镜像兼容新 schema。不要盲目重跑：脚本检测到任何自身未完成记录会拒绝继续；人工恢复完成后才可将该记录移到备份根目录之外的隔离目录。成功时会原子写入备份根目录的 `deployed-commit`。HEAD 等于目标时只有该标记也匹配且健康检查通过才认定无需部署；首次接管已部署实例但没有标记时会拒绝认定成功，需人工核实后初始化标记，或等待后续新提交交由脚本部署。不能仅为绕过保护而写标记。

retention 默认保留最近两份脚本标识完整且状态 SUCCESS 的记录，失败/历史非脚本目录不删除。只尝试删除过期记录清单中的专用 tag；共享镜像仅移除本记录 tag，其他标签及镜像实体保持可用。任何容器（含停止容器）仍引用镜像时保留 tag 和对应记录，下次 retention 自动重试，因此暂时可能超过两份。使用 `image rm --no-prune`，不运行 prune，不删除基础镜像、缓存或数据卷。此锁只协调本脚本；执行部署或保留操作期间不要另行修改 Git、镜像、容器或备份目录。

本地离线验证：

```bash
bash -n deploy-artifacts/deploy.sh
python3 -I deploy-artifacts/test_deploy.py
```
