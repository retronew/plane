# Agent Development Guide

See the Development guide for [versions](docs/development.md#版本与依赖), [env safety](docs/development.md#首次配置与已有环境), [Docker build/migration order](docs/development.md#docker-本地后端) and [troubleshooting](docs/development.md#常见排错). Do not rerun `setup.sh` over existing env files.

## 新功能交付流程

用户要求开发新功能时，默认走完以下流程；若用户明确要求只调研、只规划或暂不发布，以该次限定为准。

1. 核实目标 Plane 工作区和项目，查重后创建或复用 issue，写清范围与验收标准，将状态更新为「进行中」。
2. 从 `preview` 建带工作项编号的功能分支，实现功能并补测试；验证真实用户操作，记录结果和未通过的检查。
3. 本地验收后，将本次相关文件显式暂存并提交，提交信息带工作项编号。不要混入本机设置或其他任务的改动。
4. 按发布流程将已核准的提交部署到生产。部署目标必须是已推送到 `origin/preview` 的固定 SHA；未获合并或推送授权时，在该步骤确认，不以本地提交代替上线。
5. 线上核验服务版本及实际功能，在 issue 中回写提交、部署与验收结果；验收通过后更新为「已完成」。部署或验收受阻时记录阻塞，不提前关闭。

## Commands

- `pnpm dev` - Start frontend dev servers and shared watchers (web:3000, admin:3001; excludes Docker-provided workflow runner)
- `pnpm build` - Build all packages and apps
- `pnpm check` - Run all checks (format, lint, types)
- `pnpm check:lint` - OxLint across all packages
- `pnpm check:types` - TypeScript type checking
- `pnpm fix` - Auto-fix format and lint issues
- `pnpm turbo run <command> --filter=<package>` - Target specific package/app

## Code Style

- **Imports**: Use `workspace:*` for internal packages, `catalog:` for external deps
- **TypeScript**: Strict mode enabled, all files must be typed
- **Formatting**: oxfmt, run `pnpm fix:format`
- **Linting**: OxLint with shared `.oxlintrc.json` config
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Error Handling**: Use try-catch with proper error types, log errors appropriately
- **State Management**: MobX stores in `packages/shared-state`, reactive patterns
- **Testing**: All features require unit tests, use existing test framework per package
- **Components**: Primitives come from the published `@makeplane/propel` npm package (`@makeplane/propel/components/*`, `elements/*`, `icons`); composite/Plane-specific components live in `@plane/blocks` (`packages/blocks`, subpath imports only, e.g. `@plane/blocks/toast`). Prefer existing project UI components and nearby usage patterns for all frontend controls (especially selects, dropdowns, buttons, inputs, and dialogs). Do not substitute browser-native controls or build duplicate widgets when an existing component fits; preserve its styling, accessibility, and interaction conventions.

## Backend dependencies (uv)

`apps/api` dependencies are managed with [uv](https://docs.astral.sh/uv/): declared in `apps/api/pyproject.toml`, pinned in `apps/api/uv.lock` (commit both). Groups: `dev` and `test` (installed by default; they use `psycopg-binary`), `production` (gunicorn + the source-built `psycopg-c`; production image and migration-check only). Lint config lives in `apps/api/ruff.toml`.

- uv must be exactly the `required-version` in `apps/api/pyproject.toml` (`uv self update <version>`); bump it together with the uv image in both Dockerfiles
- Set up a local env: `cd apps/api && uv sync`
- Inside the dev/test containers, always pass `--inexact` (`uv sync --inexact`): uv targets the image's system Python there, and an exact sync would uninstall pip
- Add/upgrade a dependency: `uv add <pkg>==<version>` (or `--group test`/`--group dev`), or edit `pyproject.toml` and run `uv lock`
- Run tools: `uv run python manage.py ...`, `uv run ruff check .`

## Backend tests (Docker)

The Django/pytest suite for `apps/api` runs in an isolated stack defined by `docker-compose-test.yml` at the repo root.

Always use `-p plane-test` for the whole test stack, including its Runner; daily updates and migrations use the local stack. See [test prerequisites](apps/api/tests/RUNNING_TESTS.md#prerequisites) before running.

- Full suite: `docker compose -p plane-test -f docker-compose-test.yml up --build --abort-on-container-exit --exit-code-from api-tests`
- Subset: `docker compose -p plane-test -f docker-compose-test.yml run --rm --build api-tests pytest -m unit`
- Teardown: `docker compose -p plane-test -f docker-compose-test.yml down -v`

See [Running the suite](apps/api/tests/RUNNING_TESTS.md#running-the-suite) and [test troubleshooting](apps/api/tests/RUNNING_TESTS.md#troubleshooting) for the full workflow; see [TESTING_GUIDE](apps/api/plane/tests/TESTING_GUIDE.md) for test conventions and fixtures.
