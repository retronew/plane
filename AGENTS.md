# Agent Development Guide

See the Development guide for [versions](docs/development.md#版本与依赖), [env safety](docs/development.md#首次配置与已有环境), [Docker build/migration order](docs/development.md#docker-本地后端) and [troubleshooting](docs/development.md#常见排错). Do not rerun `setup.sh` over existing env files.

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
