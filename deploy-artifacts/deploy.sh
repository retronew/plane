#!/usr/bin/env bash
# Linux / Bash 4+; secrets and backups are never printed.
set -Eeuo pipefail
umask 077
ROOT=${PLANE_ROOT:-/opt/plane}
BACKUPS=${PLANE_BACKUPS:-/opt/plane-backups}
CADDY=${PLANE_CADDY:-/opt/caddy/Caddyfile}
REF=${PLANE_REF:-refs/remotes/origin/preview}
HOOK=${PLANE_BUILD_HOOK:-}
MODE=${1:-plan}
RECORD= PHASE=preflight
SERVICES=()
RUNTIME=()
API=0
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
compose() { docker compose --project-directory "$ROOT" -p plane -f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.override.yml" "$@"; }
clean() {
  [[ $(git -C "$ROOT" branch --show-current) == preview ]] || fail '必须在 preview 分支';
  git -C "$ROOT" diff --quiet && git -C "$ROOT" diff --cached --quiet || fail 'tracked 文件存在修改';
}
select_services() {
  local path web=0 shared=0 admin=0 space=0 live=0
  SERVICES=(); RUNTIME=(); API=0
  while IFS= read -r -d '' path; do
    case "$path" in
      apps/web/*|plugins/*|.agents/plugins/*|.claude-plugin/*) web=1 ;;
      apps/admin/*) admin=1 ;;
      apps/space/*) space=1 ;;
      apps/live/*) live=1 ;;
      apps/api/*) API=1 ;;
      packages/*|pnpm-lock.yaml|pnpm-workspace.yaml|package.json|turbo.json|.npmrc|.dockerignore) shared=1 ;;
      docs/*|deploy-artifacts/*|*.md|.github/*) ;;
      *) fail "拒绝自动部署未分类/基础设施变更: $path" ;;
    esac
  done < <(git -C "$ROOT" diff --name-only -z "$OLD" "$TARGET")
  if ((shared)); then web=1; admin=1; space=1; live=1; fi
  ((web == 0)) || SERVICES+=(web)
  ((admin == 0)) || SERVICES+=(admin)
  ((space == 0)) || SERVICES+=(space)
  ((live == 0)) || SERVICES+=(live)
  if ((API)); then SERVICES+=(api worker beat-worker migrator); fi
  for path in ${SERVICES[@]+"${SERVICES[@]}"}; do [[ $path == migrator ]] || RUNTIME+=("$path"); done
}
resolve() {
  clean
  OLD=$(git -C "$ROOT" rev-parse HEAD)
  TARGET=$(git -C "$ROOT" rev-parse --verify "$REF^{commit}")
  git -C "$ROOT" merge-base --is-ancestor "$OLD" "$TARGET" || fail '目标不是当前 HEAD 的快进';
  # These local files must never be introduced/changed by the target tree.
  local f
  for f in .env apps/api/.env docker-compose.override.yml; do
    [[ -z $(git -C "$ROOT" ls-tree "$TARGET" -- "$f") ]] || fail "目标跟踪服务器配置 $f";
  done
  select_services
  printf 'old=%s\ntarget=%s\nservices=%s\napi_migration=%s\n' "$OLD" "$TARGET" "${SERVICES[*]:-none}" "$API"
}
state() { PHASE=$1; printf '%s\n' "$PHASE" > "$RECORD/status"; }
on_exit() {
  local rc=$?
  if ((rc != 0)) && [[ -n $RECORD ]]; then
    printf 'FAILED phase=%s exit=%s\n' "$PHASE" "$rc" > "$RECORD/status"
    printf '部署失败，记录: %s；阶段: %s。未自动恢复代码、服务或 schema；服务可能仍停止。\n' "$RECORD" "$PHASE" >&2
  fi
}
dump_db() {
  local file=$1
  docker exec plane-db sh -ec 'export PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"; exec pg_dump -U "${PGUSER:-$POSTGRES_USER}" -d "${PGDATABASE:-$POSTGRES_DB}" -Fc' > "$file"
  [[ -s $file ]] || fail '数据库备份为空'
  docker exec -i plane-db pg_restore --list < "$file" > "$file.list"
  [[ -s $file.list ]] || fail '数据库备份校验失败'
}
save_images() {
  local kind=$1 svc id tag
  for svc in ${SERVICES[@]+"${SERVICES[@]}"}; do
    if [[ $kind == old && $svc != migrator ]]; then
      id=$(compose ps -aq "$svc")
      [[ -n $id && $id != *$'\n'* ]] || fail "服务 $svc 必须有且仅有一个现存容器以保存旧镜像"
      id=$(docker inspect --format '{{.Image}}' "$id")
    else
      id=$(docker image inspect --format '{{.Id}}' "$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["services"][sys.argv[2]].get("image", "plane-" + sys.argv[2]))' "$RECORD/compose.json" "$svc")")
    fi
    tag="plane-deploy-record:$ID-$kind-$svc"
    docker image tag "$id" "$tag"
    printf '%s\t%s\t%s\t%s\n' "$kind" "$svc" "$id" "$tag" >> "$RECORD/images.tsv"
  done
}
health() {
  local attempt svc cid ok status
  for attempt in {1..30}; do
    ok=1
    for svc in ${RUNTIME[@]+"${RUNTIME[@]}"}; do
      cid=$(compose ps -q "$svc")
      if [[ -z $cid ]]; then ok=0; continue; fi
      status=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")
      [[ $status == 'running healthy' || $status == 'running none' ]] || ok=0
    done
    if ((ok)) && curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8080/ >/dev/null &&
      curl --fail --silent --show-error --max-time 15 https://plane.mdropwork.com/ >/dev/null &&
      curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8080/api/instances/ >/dev/null &&
      curl --fail --silent --show-error --max-time 15 https://plane.mdropwork.com/api/instances/ >/dev/null &&
      curl --fail --silent --show-error --max-time 15 https://plane.mdropwork.com/live/health >/dev/null; then return; fi
    sleep 5
  done
  fail '健康检查超时'
}
main() {
  MODE=${1:-plan}
  case "$MODE" in plan|deploy|retention) ;; *) fail '用法: deploy.sh plan|deploy|retention [--apply]' ;; esac
  [[ $# -le 2 ]] || fail '参数过多'
  [[ ${2:-} == '' || ( $MODE == retention && $2 == --apply ) ]] || fail '无效参数'
  if [[ $MODE == plan ]]; then resolve; return; fi
  command -v flock >/dev/null || fail '需要 Linux flock'
  mkdir -p "$BACKUPS"
  [[ ! -L $BACKUPS ]] || fail '备份目录不可为 symlink'
  exec 9>"$BACKUPS/.plane-deploy.lock"
  flock -n 9 || fail '另一个部署/保留操作正在运行'
  if [[ $MODE == retention ]]; then
    python3 -I "$(dirname "${BASH_SOURCE[0]}")/retention.py" "$BACKUPS" "${2:-}"
    return
  fi
  trap on_exit EXIT
  # A failed deployment can leave HEAD at target with old/stopped containers.
  # Never treat that as a successful no-op on a subsequent invocation.
  local previous
  shopt -s nullglob
  for previous in "$BACKUPS"/plane-deploy-*/owner; do
    [[ ! -L $previous && $(<"$previous") == plane-deploy-v1 ]] || continue
    [[ -f ${previous%/owner}/status && $(<"${previous%/owner}/status") == SUCCESS ]] || fail "存在未完成部署 ${previous%/owner}；请先人工恢复并将该记录移至隔离目录，禁止盲目重跑"
  done
  clean
  local endpoint
  endpoint=${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}')}
  [[ $endpoint == unix://* ]] || fail '仅支持本机 Unix socket Docker，拒绝远程 daemon'
  [[ -f $ROOT/.env && -f $ROOT/docker-compose.override.yml && -f $CADDY ]] || fail '缺少必须保留的配置'
  [[ -L $ROOT/apps/api/.env && $(readlink -f "$ROOT/apps/api/.env") == "$(readlink -f "$ROOT/.env")" ]] || fail 'apps/api/.env 必须链接至根 .env'
  if [[ -n $HOOK ]]; then [[ $HOOK == /* && -f $HOOK && -x $HOOK ]] || fail 'build hook 必须是用户信任的绝对可执行路径'; fi
  local attempt fetched=0 svc volume_path
  for attempt in 1 2 3; do
    if GIT_TERMINAL_PROMPT=0 timeout --kill-after=10s 120s git -C "$ROOT" fetch --no-tags origin '+refs/heads/preview:refs/remotes/origin/preview'; then fetched=1; break; fi
    sleep "$attempt"
  done
  ((fetched)) || fail 'fetch 重试失败'
  resolve
  if [[ $OLD == "$TARGET" ]]; then
    [[ -f $BACKUPS/deployed-commit && $(<"$BACKUPS/deployed-commit") == "$TARGET" ]] || fail '源码已到目标但无匹配的成功部署标记，不能认定部署完成；请人工核实或显式部署后续提交'
    RUNTIME=(web admin space live api worker beat-worker)
    health
    printf '成功部署标记与目标一致，健康检查通过\n'
    return
  fi
  ID="$(date -u +%Y%m%dT%H%M%SZ)-${TARGET:0:12}-$$"
  RECORD="$BACKUPS/plane-deploy-$ID"
  mkdir "$RECORD"
  printf 'plane-deploy-v1\n' > "$RECORD/owner"
  state backup
  printf 'old=%s\ntarget=%s\nservices=%s\n' "$OLD" "$TARGET" "${SERVICES[*]}" > "$RECORD/manifest"
  cp -p "$ROOT/.env" "$RECORD/root.env"
  cp -p "$ROOT/docker-compose.override.yml" "$RECORD/docker-compose.override.yml"
  cp -p "$ROOT/docker-compose.yml" "$RECORD/docker-compose.yml"
  cp -p "$CADDY" "$RECORD/Caddyfile"
  readlink "$ROOT/apps/api/.env" > "$RECORD/api-env-link"
  compose config --format json > "$RECORD/compose.json"
  # Implicit Compose image names use the explicit project name: plane-<service>.
  : > "$RECORD/images.tsv"
  save_images old
  dump_db "$RECORD/db.dump"
  volume_path=$(docker volume inspect --format '{{.Mountpoint}}' plane_uploads)
  [[ -d $volume_path && $volume_path == /* ]] || fail '找不到本机 plane_uploads 卷路径（不支持远程 Docker）'
  tar -czf "$RECORD/uploads.tar.gz" -C "$volume_path" .
  tar -tzf "$RECORD/uploads.tar.gz" >/dev/null
  (cd "$RECORD"; sha256sum root.env docker-compose.override.yml docker-compose.yml Caddyfile api-env-link db.dump uploads.tar.gz > SHA256SUMS; sha256sum -c SHA256SUMS)
  state fast_forward
  clean
  [[ $(git -C "$ROOT" rev-parse HEAD) == "$OLD" ]] || fail '备份期间 HEAD 已改变'
  git -C "$ROOT" merge --ff-only "$TARGET"
  [[ $(git -C "$ROOT" rev-parse HEAD) == "$TARGET" ]] || fail 'HEAD 不等于锁定目标'
  cmp "$ROOT/.env" "$RECORD/root.env"
  cmp "$ROOT/docker-compose.override.yml" "$RECORD/docker-compose.override.yml"
  cmp "$CADDY" "$RECORD/Caddyfile"
  [[ $(readlink "$ROOT/apps/api/.env") == "$(<"$RECORD/api-env-link")" ]] || fail 'API env symlink 改变'
  if ((${#SERVICES[@]})); then
    state building
    if [[ -n $HOOK ]]; then
      "$HOOK" "$ROOT" "$TARGET" "$RECORD" ${SERVICES[@]+"${SERVICES[@]}"}
    else
      compose build ${SERVICES[@]+"${SERVICES[@]}"}
    fi
    clean
    [[ $(git -C "$ROOT" rev-parse HEAD) == "$TARGET" ]] || fail 'build 后 HEAD 改变'
    cmp "$ROOT/.env" "$RECORD/root.env"
    cmp "$ROOT/docker-compose.override.yml" "$RECORD/docker-compose.override.yml"
    cmp "$CADDY" "$RECORD/Caddyfile"
    [[ -L $ROOT/apps/api/.env && $(readlink "$ROOT/apps/api/.env") == "$(<"$RECORD/api-env-link")" ]] || fail 'build 后 API env symlink 改变'
    save_images new
    if ((API)); then
      state stopping_api
      compose stop api worker beat-worker
      state pre_migration_backup
      dump_db "$RECORD/db-pre-migration.dump"
      (cd "$RECORD"; sha256sum db-pre-migration.dump >> SHA256SUMS; sha256sum -c SHA256SUMS)
      state migrating_schema_may_have_changed
      compose run --rm --no-deps --no-build --pull never migrator
    fi
    state starting
    compose up -d --no-build --pull never --no-deps ${RUNTIME[@]+"${RUNTIME[@]}"}
  fi
  state health_check
  health
  printf '%s\n' "$TARGET" > "$BACKUPS/.deployed-commit.tmp"
  mv "$BACKUPS/.deployed-commit.tmp" "$BACKUPS/deployed-commit"
  state SUCCESS
  printf '成功: %s\n不自动清理；如需清理请单独运行 retention，检查后加 --apply。\n' "$RECORD"
}
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then main "$@"; fi
