# 开发指南

本文是仓库本地开发、构建和测试的统一入口。所有命令均从仓库根目录执行。贡献流程见 [CONTRIBUTING](../CONTRIBUTING.md)，API 测试细节见 [Running tests](../apps/api/tests/RUNNING_TESTS.md)。

## 版本与依赖

以仓库配置为准：

| 工具或服务           | 当前要求 / 配置                                                               |
| -------------------- | ----------------------------------------------------------------------------- |
| Node.js              | `>=22.22.0`，`.node-version` 固定 `22.22.0`                                   |
| pnpm                 | `11.10.0`，由根 `package.json` 的 `packageManager` 固定                       |
| Docker               | Docker Engine / Desktop 与 Compose v2（`docker compose`）                     |
| Python               | `>=3.12,<3.13`；开发/测试镜像为 `3.12.5-alpine`，生产 API 为 `3.12.12-alpine` |
| uv                   | 必须为 `0.12.21`，与 `apps/api/pyproject.toml` 和两个 API Dockerfile 一致     |
| PostgreSQL           | `15.7-alpine`                                                                 |
| Valkey（Redis 兼容） | `7.2.11-alpine`                                                               |
| RabbitMQ             | `3.13.6-management-alpine`                                                    |
| S3 兼容存储          | `docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z`                           |

建议至少 12 GB RAM。使用 Docker 运行后端时无需在宿主机安装 Python、uv、数据库或队列；宿主机运行前端仍需 Node.js 与 pnpm。

## 首次配置与已有环境

**已有环境不要重跑 `setup.sh`。** 脚本会无条件复制根目录以及 web/api/space/admin/live 的 `.env.example` 到 `.env`，覆盖已有配置，并重新生成 Django `SECRET_KEY`。

只有全新 checkout、尚无需要保留的 env 时，执行一次：

```sh
./setup.sh
```

脚本还会运行 `corepack enable pnpm` 和 `pnpm install`。先确保 Node.js 版本正确，且 Corepack 可用。检查所需 env 是否存在即可，不要把私有文件内容输出到终端或聊天。已有环境缺少某个 env 时，只复制对应的 `.env.example` 到**不存在**的目标文件，并私下配置；API 还需持久、随机的 `SECRET_KEY`。不要覆盖其他 env。

根 `.env` 用于 Compose 变量插值及基础设施配置；`apps/api/.env` 是后端的 `env_file`。两处数据库、队列、对象存储配置需一致。前端使用各 app 自己的 env。

### MCP OAuth 授权有效期

后端 `apps/api/.env` 可配置 `MCP_OAUTH_GRANT_DAYS=180`，默认 180 天，支持 1–365 的整数。配置错误会阻止后端启动，避免意外签发错误有效期的授权。修改环境变量后需重新创建 API 容器。

该配置只作用于新授权，不改变已有授权的到期时间。访问令牌最多有效 1 小时，客户端可通过刷新令牌轮换续接，但不会延长授权的总有效期。授权到期或在 Plane「个人菜单 → 开发者 → 授权连接」撤销后，下一次 MCP 请求返回 `401` 和 OAuth 发现信息，刷新返回 `invalid_grant`；需要从客户端重新发起 OAuth 授权。每个客户端连接独立处理。

Plane 的「重新授权」操作会撤销所选连接，并提示回到客户端连接；它不能直接唤起客户端的 PKCE 流程。如果桌面客户端没有显示重连入口，可先新建聊天调用插件，让客户端重新检测认证；具体重连入口由客户端版本决定。卸载插件不等于撤销服务端授权。

本地 Codex 插件还可通过客户端随附的 CLI 发起重连：先用 `codex mcp list` 确认服务名，再运行 `codex mcp login plane`（服务名不同时替换 `plane`），在浏览器中完成授权。也可通过官方 app-server 的 `mcpServer/oauth/login` 发起；已在本地验证该接口完成浏览器回调后，当前聊天的 Plane 工具恢复可用。这不代表所有桌面版本都在设置页提供重连按钮。

授权页从后端读取有效天数，并将该天数绑定到签名授权请求；用户确认前即使管理员调整配置，也不会改变已展示的授权时长。旧版签名请求保留原先展示的 30 天，新请求采用当前配置。

### Runner token

本地 Compose 启动包含真实 Workflow Runner，必须配置至少 32 字符的独立随机 `WORKFLOW_RUNNER_SERVICE_TOKEN`。在私有根 `.env` 中持久保存一次，API、worker、Beat 与 Runner 通过 Compose 的 `environment` 接收同一值；不要每次启动都生成新值，也不要只放在 API env 中。

若根 `.env` 已存在且尚无该变量，可用以下命令直接追加随机值，不打印 token；已有变量时不要重复追加：

```sh
(umask 077; printf '\nWORKFLOW_RUNNER_SERVICE_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env)
chmod 600 .env
```

不要提交 `.env`、把 token 放进前端 env、复用 `SECRET_KEY`，或通过 `cat .env`、`docker compose config`、shell trace、截图或日志泄漏它。shell 中同名导出变量会覆盖根 `.env` 的插值；若有旧的会话值，先 `unset WORKFLOW_RUNNER_SERVICE_TOKEN`。Runner 协议及独立开发见 [Runner README](../apps/workflow-runner/README.md)。

## Docker 本地后端

使用 `docker-compose-local.yml`。开发数据保存在命名卷中，API 源码挂载到 `/code`；前端在宿主机由 pnpm 启动。

`worker` 通过 `docker-entrypoint-worker.sh` 启动 `celery -A plane worker`，从队列消费并执行异步任务；`beat-worker` 通过 `docker-entrypoint-beat.sh` 启动 `celery -A plane beat`，按计划向队列投递任务，再由 worker 执行。两者共用 API 镜像，但运行不同进程，启动前都会等待数据库及迁移就绪。定时配置见 `apps/api/plane/celery.py`，使用 `django-celery-beat` 的数据库调度器；同一环境的 Beat 通常只运行一个实例，避免重复投递。

首次启动或后端镜像依赖变化后，按顺序执行：

```sh
# worker、beat-worker、migrator 复用此镜像，自身没有 build 配置。
docker compose -f docker-compose-local.yml build api

# run 会启动 migrator 的数据库和 Valkey 依赖；脚本先 wait_for_db，再 migrate。
docker compose -f docker-compose-local.yml run --rm migrator

# 迁移成功后启动 API、队列、存储、worker、Beat 和 Runner。
docker compose -f docker-compose-local.yml up -d --build
```

不能只对 migrator 使用 `--build` 来代替 `build api`。API 入口会等待数据库和迁移完成，但不会替你执行迁移。日常重启已有镜像可运行：

```sh
docker compose -f docker-compose-local.yml up -d
```

更新含迁移的代码后，先重新构建 API 镜像（依赖变化时必须），运行上述 migrator，再启动或重建相关服务。首次数据库就绪等待由 migrator 脚本处理。

```sh
# 查看状态与定向日志；分享日志前先脱敏。
docker compose -f docker-compose-local.yml ps
docker compose -f docker-compose-local.yml logs --tail=100 api migrator workflow-runner

# 停止并保留容器及数据。
docker compose -f docker-compose-local.yml stop

# 移除开发容器和网络，保留命名数据卷。
docker compose -f docker-compose-local.yml down
```

**开发环境不要加 `-v`**，否则会删除数据库、上传文件等命名卷。Compose 默认项目名通常为目录名 `plane`；已有环境继续使用原项目名，不要无意切换项目而创建另一套空数据卷。

## pnpm 开发与构建

已有环境安装或更新锁定依赖：

```sh
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

根 `dev` 启动前端及共享包 watcher，排除 Docker 已提供的 `@plane/workflow-runner`。首次访问 `http://localhost:3001/god-mode/` 创建实例管理员，再在 `http://localhost:3000` 登录。

```sh
pnpm build
pnpm check
# 定向执行某个包的命令：
pnpm turbo run check:types --filter=web
```

`pnpm build` 构建工作区包和应用，不会启动后端、执行数据库迁移或完成生产部署。

若需在宿主机运行后端工具，安装 Python 3.12 与精确版本 uv 后，在 `apps/api` 运行 `uv sync`，使用 `uv run python manage.py ...` 或 `uv run ruff check .`。容器内依赖安装必须使用 `uv sync --locked --inexact`，避免移除系统 Python 的 pip。

### 新建工作区的默认时区

新建工作区省略 `timezone` 时，后端在启动时依次读取 `TZ` 环境变量、`/etc/timezone`、`/etc/localtime` 指向的 zoneinfo 路径，使用有效的 IANA 时区（例如 `Asia/Shanghai`）；无法识别时回退 `UTC`。新项目继续继承所属工作区的时区，显式指定的时区优先。已有工作区和项目不会被自动修改；用户个人时区仍由浏览器首次检测和个人偏好控制。

Docker 容器不会自动继承宿主机时区。本地开发可在 `apps/api/.env` 设置 `TZ=Asia/Shanghai`，然后重建 API 容器；生产部署应在 API、worker、Beat 和 migrator 的环境中传入相同的 `TZ`，或挂载系统时区文件。此默认值与 Django/Celery 的 UTC 存储及调度配置分开，修改 `TZ` 不会更改 `TIME_ZONE` 或 `CELERY_TIMEZONE`。

## 隔离 API 测试

API 测试使用 `docker-compose-test.yml` 的独立临时栈，日常更新和迁移仍使用 local 栈。测试整栈统一使用 **`-p plane-test`**，避免干扰开发 Runner。

环境前提、全量与定向运行、清理命令统一见 [API 测试指南：Prerequisites](../apps/api/tests/RUNNING_TESTS.md#prerequisites) 和 [Running the suite](../apps/api/tests/RUNNING_TESTS.md#running-the-suite)；测试架构及专用 Runner 配置见 [How it works](../apps/api/tests/RUNNING_TESTS.md#how-it-works)。用例、marker 和 fixture 约定见 [TESTING_GUIDE](../apps/api/plane/tests/TESTING_GUIDE.md)。

## 生产镜像与本地镜像

根 `docker-compose.yml` 使用生产 Dockerfile；`docker-compose-local.yml` 使用开发 API 镜像与源码挂载。生产 API 安装 `production` 依赖组（gunicorn、源码构建的 `psycopg-c`），不含默认 dev/test 组或 uv 可执行文件；开发/测试镜像包含 dev/test 组、`psycopg-binary` 与 uv。不要在生产镜像里执行 pytest 或 `uv sync`。

```sh
# 仅构建根 Compose 声明的生产镜像，并非完整生产部署。
docker compose -f docker-compose.yml build
```

生产部署还需单独处理配置、密钥、迁移、网络和数据持久化，参见 [部署文档](https://developers.plane.so/self-hosting/overview)。Community Runner 镜像需要与 `APP_RELEASE` 匹配，或用 `WORKFLOW_RUNNER_IMAGE` 指定私有镜像，见 [项目工作流运维](./project-workflows.md#10-部署与运维)。

## 常见排错

- **找不到 `plane-api:local`**：先 `docker compose -f docker-compose-local.yml build api`，再运行 migrator。
- **API 一直等待迁移 / 表不存在**：确认 migrator 成功退出；查看其日志，按上述顺序重新执行迁移。API 启动本身不会迁移。
- **env 缺失**：仅从对应 example 补缺失文件；已有环境不要重跑 setup，也不要输出完整配置排查。
- **Runner 启动失败或 401**：确认私有根 `.env` 的 token 长度、shell 覆盖值和各进程配置一致。更改后重建容器使环境生效：`docker compose -f docker-compose-local.yml up -d --build --force-recreate workflow-runner api worker beat-worker`。
- **端口被占用**：本地开发发布 5432、6379、8000、9000、9090，前端使用 3000/3001 等端口。检查占用者与运行项目；测试栈本身不发布端口，无需为测试停止开发栈。
- **测试隔离、镜像或数据问题**：见 [API 测试排错](../apps/api/tests/RUNNING_TESTS.md#troubleshooting)。
- **依赖版本不符或安装失败**：核对 Node、pnpm、uv 版本及锁文件；不要以更新锁文件掩盖环境版本问题。
