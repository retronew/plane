# Running the API Test Suite

This guide covers running the Django/pytest suite for `apps/api` inside Docker via `docker-compose-test.yml` at the repo root. The compose file boots an isolated stack — Postgres, Valkey (Redis), RabbitMQ, MinIO — with tmpfs-backed data directories. Data is lost when those containers stop or are removed; reusing running containers is not a fresh environment.

For background on the test layout, markers, and fixtures, see [`TESTING_GUIDE.md`](../plane/tests/TESTING_GUIDE.md). Setup, versions and local development commands are in the [Development guide](../../../docs/development.md).

## Prerequisites

- Docker and Docker Compose v2 (`docker compose ...`)
- Prepare `apps/api/.env` using [First-time setup and existing environments](../../../docs/development.md#首次配置与已有环境). Do not rerun `setup.sh` over existing env files.

The `test-*` services are dedicated to backend tests. Daily development updates, image rebuilds and migrations use `docker-compose-local.yml`. Test and development stacks both have a `workflow-runner` service, so every test Compose command must use **`-p plane-test`** for project isolation, including commands that start only the Runner.

## Running the suite

All commands are run from the repo root.

### Full suite

```bash
docker compose -p plane-test -f docker-compose-test.yml up \
  --build \
  --abort-on-container-exit \
  --exit-code-from api-tests
```

- `--build` builds the `api-tests` and Runner images when `Dockerfile.dev`, `pyproject.toml` or `uv.lock` change.
- `--abort-on-container-exit` stops the dependency services as soon as `api-tests` exits.
- `--exit-code-from api-tests` propagates pytest's exit code so this works in CI.

### Filtered runs

Use `docker compose run` to override the default `pytest` command. Anything you pass after the service name is forwarded to pytest.

```bash
# Only unit tests (marker defined in pytest.ini)
docker compose -p plane-test -f docker-compose-test.yml run --rm --build api-tests pytest -m unit

# A single directory, filtered by name
docker compose -p plane-test -f docker-compose-test.yml run --rm --build api-tests \
  pytest plane/tests/unit -k "test_workspace"

# Single file with verbose output
docker compose -p plane-test -f docker-compose-test.yml run --rm --build api-tests \
  pytest plane/tests/unit/models/test_workspace.py -vv
```

The available markers (`unit`, `contract`, `smoke`, `slow`) are declared in `apps/api/pytest.ini`.

### Teardown

```bash
docker compose -p plane-test -f docker-compose-test.yml down -v
```

This removes only the `plane-test` project’s containers, network and volumes (including anonymous volumes). The service data directories use tmpfs and disappear when the containers stop. Run teardown after testing; never apply `down -v` to the development project, whose named volumes contain persistent data.

## How it works

| Service           | Image                                               | Purpose                                      |
| ----------------- | --------------------------------------------------- | -------------------------------------------- |
| `test-db`         | `postgres:15.7-alpine`                              | Application database                         |
| `test-redis`      | `valkey/valkey:7.2.11-alpine`                       | Cache / Celery broker                        |
| `test-mq`         | `rabbitmq:3.13.6-management-alpine`                 | Task queue                                   |
| `test-minio`      | `docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z` | S3-compatible object storage                 |
| `workflow-runner` | built from `apps/workflow-runner/Dockerfile`        | Real JavaScript Runner for integration tests |
| `api-tests`       | built from `apps/api/Dockerfile.dev`                | `uv sync`s the locked deps, runs pytest      |

All five dependencies expose health checks; `api-tests` waits for `service_healthy` on each via `depends_on`, so pytest only starts once the stack is ready. Test services do not publish host ports.

The Runner uses a public test-only service token on the isolated test network and Broker origin `http://api-tests:8000`. Django integration tests must bind their temporary Broker server to `0.0.0.0:8000`. This token is not a production default.

Test-time env overrides live in the compose file itself (`POSTGRES_HOST=test-db`, `REDIS_URL=redis://test-redis:6379/`, `AWS_S3_ENDPOINT_URL=http://test-minio:9000`, `DJANGO_SETTINGS_MODULE=plane.settings.test`). Everything else is inherited from `apps/api/.env`.

## Troubleshooting

- **`./apps/api/.env: no such file or directory`** — prepare the missing file as described in the development guide; do not rerun setup over existing env files.
- **Runner collides with development services** — use `-p plane-test` for every test Compose command, including commands starting only the Runner; mixing project names breaks isolation and network/DNS assumptions.
- **Port already in use** — test services do not publish host ports. Inspect which other service owns the port; isolated tests do not require stopping the local development stack.
- **Missing uv or stale image after dependency changes** — rebuild explicitly: `docker compose -p plane-test -f docker-compose-test.yml build --no-cache api-tests`.
- **MinIO bucket missing** — the `test-minio` entrypoint creates the bucket named by `AWS_S3_BUCKET_NAME` (default `uploads`). Change the value in `apps/api/.env` and re-run.
- **Database state leaking between runs** — tear down the isolated project with `docker compose -p plane-test -f docker-compose-test.yml down -v` before starting an unrelated session. Reusing a running dependency container retains its tmpfs data. External volumes are not removed by Compose teardown.
