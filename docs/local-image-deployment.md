# 本地构建镜像并更新线上 Plane

本流程与 [原有服务器构建部署](../deploy-artifacts/README.md) 并存，不替换原脚本。日常可选择任一种，但同一时刻只能运行一轮部署；服务器专用构建入口和切换前服务器构建的回滚镜像继续保留。

适用于本项目已配置好的生产实例。流程为：锁定已推送提交 → 干净目录构建 Linux AMD64 镜像 → 压缩上传 → 远端校验加载 → 备份 → 切换 → 健康检查 → 清理。本机使用官方 npm 源，不修改本地或服务器仓库的 Dockerfile、`.npmrc`、锁文件与环境文件。

## 环境与边界

| 项目           | 配置                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| SSH            | `root@47.108.224.79`，密钥由 1Password SSH agent 提供                           |
| 入口           | https://plane.mdropwork.com                                                     |
| 服务器源码     | `/opt/plane`，`preview` 分支                                                    |
| Compose        | project `plane`，根 `docker-compose.yml` + 服务器 `docker-compose.override.yml` |
| 配置           | 根 `.env`，`apps/api/.env` 必须软链接到根 `.env`                                |
| 公共 Caddy     | `/opt/caddy/Caddyfile`，转发到 `127.0.0.1:8080`                                 |
| 备份           | `/opt/plane-backups`，权限仅 root 可读                                          |
| 数据卷         | `plane_pgdata`、`plane_uploads`、`plane_redisdata`、`plane_rabbitmq_data`       |
| 服务器部署工具 | `/opt/plane-deploy`；服务器专用构建源配置不影响本机                             |

本机需要 Git、Docker/Buildx、Python 3、gzip、SSH/SCP；服务器需要 Docker Compose、Python 3、GNU tar、curl、flock。Apple Silicon 必须显式使用 `--platform linux/amd64`。全量只指七个应用镜像，数据库、对象存储、Redis、RabbitMQ 和公共 Caddy 不重建、不替换数据。

不要执行 `setup.sh`、`docker compose down -v` 或全局 `docker system prune -a --volumes`。不要输出 `.env`、解析后的完整 Compose 配置或认证令牌。构建上传全部完成前不停止线上服务。

## 1. 锁定提交与准备目录（本机）

以下 Bash 片段按章节在同一个 shell 执行。进入仓库根目录后运行；1Password 如弹出授权请求，正常批准对应服务器密钥。不要复制私钥。

```bash
export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
```

```bash
git fetch origin preview && export DEPLOY_SHA="$(git rev-parse refs/remotes/origin/preview)" && export DEPLOY_TAG="${DEPLOY_SHA:0:12}-amd64" && export DEPLOY_DIR="$(mktemp -d /tmp/plane-deploy.XXXXXX)" && mkdir "$DEPLOY_DIR/source" && git archive "$DEPLOY_SHA" | tar -xf - -C "$DEPLOY_DIR/source"
```

`git archive` 只包含指定提交，不能直接从共享工作目录 `docker build .`，也不能打包未提交文件、私有 env、工作区 node_modules。记录完整 SHA，部署期间不自动追随新的远端提交。

```bash
ssh root@47.108.224.79 'cd /opt/plane && git status --short && git rev-parse HEAD && df -h / && docker compose ps'
```

服务器 tracked 文件必须无修改；已知 untracked `docker-compose.override.yml` 是专用配置，应保留。确认没有另一轮部署或构建正在运行。空间必须同时容纳归档、解压后的新镜像和当前回滚镜像；本次曾在约 19 GB 空闲时进行全量测试，不能只按压缩包大小估算空间。

## 2. 本地构建

全量构建包括 `web api admin space live workflow-runner proxy`，其中 worker、Beat 和 migrator 复用 API 镜像。代码变化仅涉及部分应用时，可人工评估后缩小列表；共享包变更可能影响所有前端。基础镜像按仓库 Dockerfile 获取，不使用服务器专用 npm 镜像配置。

```bash
for service in web api admin space live workflow-runner proxy; do
  case "$service" in
    api) context="$DEPLOY_DIR/source/apps/api"; dockerfile="$context/Dockerfile.api" ;;
    proxy) context="$DEPLOY_DIR/source/apps/proxy"; dockerfile="$context/Dockerfile.ce" ;;
    workflow-runner) context="$DEPLOY_DIR/source"; dockerfile="$context/apps/workflow-runner/Dockerfile" ;;
    *) context="$DEPLOY_DIR/source"; dockerfile="$context/apps/$service/Dockerfile.$service" ;;
  esac
  docker buildx build --platform linux/amd64 --load --tag "plane-$service:$DEPLOY_TAG" --label "org.opencontainers.image.revision=$DEPLOY_SHA" --file "$dockerfile" "$context" > "$DEPLOY_DIR/build-$service.log" 2>&1 || break
 done
```

任何失败都先检查对应日志，不能继续上传不完整版本。下一步会检查全部七个镜像存在且版本一致。生产构建参数如有自定义公开 URL，应按服务器原构建参数传入；不要将后端密钥作为构建参数写入镜像。

## 3. 校验、打包、上传

```bash
export DEPLOY_SHA DEPLOY_TAG DEPLOY_DIR
python3 - <<'PY'
import gzip, hashlib, json, os, subprocess
from pathlib import Path
root = Path(os.environ['DEPLOY_DIR'])
sha, tag = os.environ['DEPLOY_SHA'], os.environ['DEPLOY_TAG']
tags = [f'plane-{name}:{tag}' for name in ['web','api','admin','space','live','workflow-runner','proxy']]
images = json.loads(subprocess.check_output(['docker','image','inspect',*tags], text=True))
rows = []
for name, image in zip(tags, images):
    assert image['Architecture'] == 'amd64' and image['Os'] == 'linux'
    assert image['Config']['Labels']['org.opencontainers.image.revision'] == sha
    rows.append({'tag': name, 'id': image['Id'], 'revision': sha})
(root/'images.json').write_text(json.dumps(rows, indent=2))
process = subprocess.Popen(['docker','save',*tags], stdout=subprocess.PIPE)
with gzip.open(root/'images.tar.gz','wb',compresslevel=1) as output:
    while chunk := process.stdout.read(1024*1024):
        output.write(chunk)
assert process.wait() == 0
checksum = hashlib.sha256()
with (root/'images.tar.gz').open('rb') as source:
    for chunk in iter(lambda: source.read(1024*1024), b''):
        checksum.update(chunk)
(root/'SHA256SUMS').write_text(checksum.hexdigest()+'  images.tar.gz\n')
PY
```

每次使用全新接收目录。先复制到 `.part`，传完才改名，避免中断传输被误加载。

```bash
export REMOTE_RELEASE="/opt/plane-backups/incoming-$DEPLOY_TAG" && ssh root@47.108.224.79 "umask 077; mkdir '$REMOTE_RELEASE'" && scp "$DEPLOY_DIR/images.tar.gz" "root@47.108.224.79:$REMOTE_RELEASE/images.tar.gz.part" && scp "$DEPLOY_DIR/images.json" "$DEPLOY_DIR/SHA256SUMS" "root@47.108.224.79:$REMOTE_RELEASE/" && ssh root@47.108.224.79 "mv '$REMOTE_RELEASE/images.tar.gz.part' '$REMOTE_RELEASE/images.tar.gz'; cd '$REMOTE_RELEASE' && sha256sum -c SHA256SUMS && docker load -i images.tar.gz"
```

上传 manifest 和 SHA256 校验文件通过同一 SSH 通道；这用于完整性校验，不替代可信提交来源检查。镜像加载不会自动替换正在运行的容器。

## 4. 更新服务器源码

服务器源码必须同步到同一 SHA，用于记录版本、Compose 和迁移来源。先正常 fetch；确认目标存在、当前 HEAD 是目标祖先、没有 tracked 修改，再快进至固定 SHA。

```bash
ssh root@47.108.224.79 "cd /opt/plane && git fetch origin preview && git diff --quiet && git diff --cached --quiet && test \"\$(git branch --show-current)\" = preview && git merge-base --is-ancestor HEAD '$DEPLOY_SHA' && git merge --ff-only '$DEPLOY_SHA'"
```

若 GitHub 超时，可传 Git bundle：先从服务器获取当前 SHA，在本机确认祖先关系，再从已提交引用生成增量 bundle。`git bundle verify` 成功后用**文件路径** fetch bundle；不要将 bundle 写成 `file://` 仓库地址。之后仍快进到固定 SHA。不能仅凭源码 HEAD 已更新就认为部署成功。

更新前审核 Compose、Dockerfile、环境变量和基础设施变更。若 Compose 有变更，必须单独核对服务器 override 合并效果、数据卷及公开端口；不能直接沿用下面命令。

## 5. 备份并切换（服务器）

以下是服务器 Bash 操作。先将 `release` 和 `target` 替换为本次实际路径与完整 SHA。此代码块包含全部状态变量，请整体执行；同一时刻不运行其他部署。

```bash
set -Eeuo pipefail
umask 077
release=/opt/plane-backups/incoming-REPLACE_TAG
 target=REPLACE_FULL_COMMIT_SHA
cd /opt/plane
exec 9>/opt/plane-backups/.plane-deploy.lock
flock -n 9
test "$(git branch --show-current)" = preview
git diff --quiet
git diff --cached --quiet
test "$(git rev-parse HEAD)" = "$target"
test -L apps/api/.env
test "$(readlink -f apps/api/.env)" = "$(readlink -f .env)"
backup="/opt/plane-backups/local-release-$(date +%Y%m%d-%H%M%S)"
mkdir "$backup"
printf 'PREPARING\n' > "$backup/status"
cp .env docker-compose.yml docker-compose.override.yml "$backup/"
cp /opt/caddy/Caddyfile "$backup/public-Caddyfile"
cp "$release/images.json" "$backup/images.json"
printf '%s\n' "$target" > "$backup/target-commit"
export PLANE_RELEASE="$release" PLANE_TARGET="$target"
python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
rows = json.loads((Path(os.environ['PLANE_RELEASE'])/'images.json').read_text())
assert len(rows) == 7
for row in rows:
    image = json.loads(subprocess.check_output(['docker','image','inspect',row['tag']],text=True))[0]
    assert image['Id'] == row['id'] and image['Architecture'] == 'amd64'
    assert image['Config']['Labels']['org.opencontainers.image.revision'] == os.environ['PLANE_TARGET']
PY
for service in web api admin space live workflow-runner proxy; do
  cid=$(docker compose ps -q "$service")
  test -n "$cid"
  image=$(docker inspect --format '{{.Image}}' "$cid")
  rollback="plane-rollback:$(basename "$backup")-$service"
  docker tag "$image" "$rollback"
  printf '%s\t%s\t%s\n' "$service" "$image" "$rollback" >> "$backup/rollback.tsv"
done
docker exec plane-db sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/database.dump"
docker exec -i plane-db pg_restore --list < "$backup/database.dump" > "$backup/database.list"
test -s "$backup/database.dump"
uploads=$(docker volume inspect --format '{{.Mountpoint}}' plane_uploads)
tar -czf "$backup/uploads.tar.gz" -C "$uploads" .
tar -tzf "$backup/uploads.tar.gz" >/dev/null
(cd "$backup"; sha256sum .env docker-compose.yml docker-compose.override.yml public-Caddyfile database.dump uploads.tar.gz > SHA256SUMS; sha256sum -c SHA256SUMS)
printf 'BACKED_UP\n' > "$backup/status"
```

附件从宿主机卷路径归档，不要在 MinIO 容器中调用 tar（该镜像没有 tar）。这是在线备份；需要跨数据库/附件严格一致时，应安排维护窗口并停止所有写入。

确认备份成功后，继续在同一个服务器 shell 执行。先停止 API 和任务进程，再备份一次数据库，所有图片/前端服务仍保持运行直至更新。没有迁移也可运行 migrator 检查，已应用的迁移不会重跑。

```bash
docker compose stop -t 60 api worker beat-worker
docker exec plane-db sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/db-pre-migration.dump"
docker exec -i plane-db pg_restore --list < "$backup/db-pre-migration.dump" > "$backup/db-pre-migration.list"
while IFS=$'\t' read -r service image rollback; do
  printf '%s\t%s\n' "$service" "$rollback"
done < "$backup/rollback.tsv"
python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
for row in json.loads((Path(os.environ['PLANE_RELEASE'])/'images.json').read_text()):
    name = row['tag'].split(':')[0]
    subprocess.run(['docker','tag',row['id'],name+':latest'],check=True)
for role in ['worker','beat-worker','migrator']:
    subprocess.run(['docker','tag','plane-api:latest','plane-'+role+':latest'],check=True)
PY
printf 'MIGRATING\n' > "$backup/status"
docker compose run --rm --no-deps --pull never -T migrator </dev/null
printf 'STARTING\n' > "$backup/status"
docker compose up -d --no-build --pull never --no-deps api worker beat-worker web admin space live workflow-runner proxy
```

`docker compose run` 不支持本服务器版本的 `--no-build`，不要给迁移命令添加该参数；它默认使用现存镜像，`--pull never` 禁止拉取。`up` 则保留 `--no-build`。

## 6. 健康与版本验证

刚启动时可能短暂返回 502，只有全部检查通过才记录成功。以下轮询有超时，失败后保留备份和日志，不能写成功标记。

```bash
ready=0
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 10 -o /dev/null https://plane.mdropwork.com/ && curl -fsS --max-time 10 -o /dev/null https://plane.mdropwork.com/api/instances/ && curl -fsS --max-time 10 -o /dev/null https://plane.mdropwork.com/live/health; then
    ready=1
    break
  fi
  sleep 5
done
test "$ready" = 1
docker compose exec -T api python manage.py migrate --check </dev/null
python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
names={'web':'web','api':'api','admin':'admin','space':'space','live':'plane-live','workflow-runner':'plane-workflow-runner-1','proxy':'proxy'}
rows=json.loads((Path(os.environ['PLANE_RELEASE'])/'images.json').read_text())
for row in rows:
    service=row['tag'].split(':')[0].removeprefix('plane-')
    container=json.loads(subprocess.check_output(['docker','inspect',names[service]],text=True))[0]
    assert container['Image']==row['id'] and container['State']['Running']
    assert container['State'].get('Health',{}).get('Status','healthy')=='healthy'
for role, name in [('worker','bgworker'),('beat-worker','beatworker')]:
    container=json.loads(subprocess.check_output(['docker','inspect',name],text=True))[0]
    api=next(row['id'] for row in rows if row['tag'].startswith('plane-api:'))
    assert container['Image']==api and container['State']['Running']
PY
cmp .env "$backup/.env"
cmp docker-compose.override.yml "$backup/docker-compose.override.yml"
cmp /opt/caddy/Caddyfile "$backup/public-Caddyfile"
printf '%s\n' "$target" > /opt/plane-backups/.deployed-commit.tmp
mv /opt/plane-backups/.deployed-commit.tmp /opt/plane-backups/deployed-commit
printf 'SUCCESS\n' > "$backup/status"
docker compose ps
```

还需按本次功能范围验证登录、工作项操作、飞书通知和附件上传下载。HTTP 200、健康检查及迁移检查不等于全部业务回归通过。本次试验未做所有业务操作的端到端回归。

## 7. 回滚与失败处理

构建、上传、校验或备份失败：停止后续步骤，旧容器继续运行。切换后失败：检查本次 `status`、备份、容器状态和定向日志，不删除失败记录。不要输出包含用户隐私的原始请求日志。

未发生不兼容迁移时，可把 `rollback.tsv` 指向的镜像重新打为对应 `plane-服务:latest`，API 旧镜像同时用于 worker/beat-worker/migrator，再执行同样的 `up` 和健康检查。先确认该镜像仍存在；记录中的源码版本不能替代镜像 ID。

发生迁移时，旧镜像不一定兼容新数据库；先审核迁移可逆性。数据库恢复会丢失备份之后的写入，应在明确维护窗口和恢复方案下操作，本文不自动执行恢复。源码 HEAD 和 `/opt/plane-backups/deployed-commit` 也必须反映最终实际运行版本；只有回滚验证成功后才能更新标记。

## 8. 清理与保留策略

成功验证后清理，失败时保留排错材料。**备份可多留，历史业务镜像只保留一套回滚。** 当前运行镜像、所有容器引用的镜像（含停止容器）和基础镜像不能删除。根据镜像 ID 合并判断所有 tag，不能仅按 tag 日期批量删。

服务器：删除本轮 `incoming-*` 内的 `images.tar.gz`，保留 manifest、SHA256 和部署记录；清理早于本次 rollback.tsv 的旧业务镜像。保留多份数据库、附件和配置备份，不能把旧版 `retention --apply` 当作本流程的“一套镜像、多份备份”策略（它的备份记录保留规则不同）。本轮仅在成功时删除两个上传归档与更早业务镜像。

服务器不再承担构建后，可在确认无构建任务时回收普通 BuildKit 层，保留依赖下载缓存；这会让下次服务器回退构建需要重新建立部分缓存。

```bash
docker buildx prune --force --all --filter 'type=regular'
```

本机：服务器版本和健康验证成功后，删除本次七个镜像标签与归档，保留基础镜像和构建缓存。本地缓存仍占空间，定期按实际磁盘情况另行评估；不要每次清空，否则下次构建变慢。

```bash
for service in web api admin space live workflow-runner proxy; do docker image rm --no-prune "plane-$service:$DEPLOY_TAG" || break; done
```

```bash
rm -f "$DEPLOY_DIR/images.tar.gz"
```

确认路径属于本轮 mktemp 创建的目录后，再自行删除独立源码目录；保留构建日志、镜像 manifest 和计时记录便于比较。本地镜像删除不影响已经加载至服务器的镜像。

## 9. 2026-10-28 实测记录

固定提交 `05f88db95b1010fff275790a4b2320f0b135773c`。本机为 ARM，Docker 分配 18 CPU、约 16 GB RAM；服务器约 3.6 GB RAM，有 4 GB Swap。没有严格统一冷热缓存，不作为标准基准。

| 阶段                     | 实测                                                       |
| ------------------------ | ---------------------------------------------------------- |
| API 本地构建             | 97.77 秒                                                   |
| Admin 本地构建           | 62.32 秒                                                   |
| Space 本地构建           | 82.66 秒                                                   |
| Live 本地构建            | 117.86 秒                                                  |
| Workflow Runner 本地构建 | 53.09 秒                                                   |
| Proxy 本地构建           | 138.07 秒                                                  |
| 上述六项顺序构建合计     | 551.77 秒，约 9.2 分钟                                     |
| Web                      | 另行先构建成功，未记录可靠的完整墙钟时间，不计入上面的合计 |
| 七应用归档               | 752,596,458 字节，约 752.6 MB（十进制）                    |
| 导出压缩                 | 10.46 秒                                                   |
| SCP 上传                 | 621.77 秒，约 10 分 22 秒，约 1.21 MB/s                    |
| 服务器加载               | 69.89 秒                                                   |
| 切换及检查               | 成功；未独立计时                                           |
| 最终空间                 | 40 GB 磁盘，约 19 GB 可用、51% 使用率；备份约 368 MB       |

本次七个服务的运行镜像 ID 均匹配本地 manifest，Web/Admin/Space/Runner 健康，首页/API/Live 返回 200，迁移检查通过。本地测试镜像和归档已删除，远端保留当前镜像、一套切换前回滚及正常备份。

完整归档上传是当前明显耗时：日常优先按变更选择应用；需要进一步减少传输，可再评估支持镜像层复用的私有仓库。GHCR 入口和 token 接口曾可达，但尚未验证大层持续下载与免费额度，当前流程不依赖任何收费镜像仓库。
