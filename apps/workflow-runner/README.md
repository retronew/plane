# Workflow Runner

Trusted Node.js supervisor with a fresh child process and QuickJS-WASM runtime per execution. Requires Node >=22.22.0; `quickjs-emscripten` is pinned to 0.31.0 in the workspace catalog/lockfile. Scripts are JavaScript **function bodies** and may use `return`, `await`, `context`, `sdk`, and `console`.

```js
const item = await sdk.getWorkItem();
console.info("Checking", item.id);
return { success: context.proposed.name.length > 0, reason: "A name is required" };
```

## HTTP contract

- `GET /healthz` returns `{ "status": "ok" }` without authorization.
- `POST /execute` requires `Authorization: Bearer <WORKFLOW_RUNNER_SERVICE_TOKEN>` and `Content-Type: application/json`.
- Body limit: 1 MiB; source and context each <=256 KiB. IDs contain 1–128 letters/digits/`_.:-`.

```json
{
  "execution_id": "run-id.step-id",
  "source": "const item = await sdk.getWorkItem(); return {success: !!item};",
  "context": { "before": {}, "proposed": {}, "after": {}, "actor": {} },
  "phase": "pre",
  "limits": { "wall_time_ms": 5000 },
  "broker": {
    "url": "http://api:8000/api/internal/workflow-runner/rpc/",
    "token": "short-lived-Django-signed-run-lease-step-capability"
  }
}
```

Response always uses this shape (execution errors are HTTP 200; request/auth/capacity failures use 400/401/429):

```json
{
  "success": true,
  "result": { "success": false, "reason": "A name is required" },
  "logs": [{ "level": "info", "message": "Checking item-id" }],
  "error": null,
  "metrics": { "duration_ms": 47, "rpc_calls": 1, "log_bytes": 16 }
}
```

`success` describes execution. A valid pre result `{success:false,reason?:string}` still has outer `success:true`; Django must reject that transition. Pre requires an object with boolean `success` and optional string `reason`. Post accepts any JSON value (including null). Undefined, cyclic objects, and BigInt are invalid results. JavaScript's JSON serialization semantics apply (e.g. non-finite numbers serialize as null). Error shape: `{code,message}`; known codes are `INVALID_REQUEST`, `UNAUTHORIZED`, `BUSY`, `TIMEOUT`, `MEMORY_LIMIT`, `LOG_LIMIT`, `RPC_LIMIT`, `RPC_ERROR`, `INVALID_RESULT`, `SCRIPT_ERROR`, `CHILD_EXIT`, `INTERNAL_ERROR`. Script syntax/stack failures use `SCRIPT_ERROR`; fatal native/WASM failures may use `CHILD_EXIT`. Messages and console output never include transport exception details.

Console supports `log`, `info`, `warn`, `error`, `debug`. String arguments are preserved; other arguments use JSON serialization and arguments are joined by a space. No script stack/source text is sent automatically.

## SDK and broker

All SDK methods return real Promises. Await every call, including post actions; returning while calls remain pending fails closed.

| Method                                                 | Parameters                     | Phase    |
| ------------------------------------------------------ | ------------------------------ | -------- |
| `sdk.getWorkItem(id?)`                                 | Current item when omitted      | pre/post |
| `sdk.addComment(issueId, body)`                        | Comment body string            | post     |
| `sdk.addLabels(issueId, labelIds)`                     | Array of label IDs             | post     |
| `sdk.removeLabels(issueId, labelIds)`                  | Array of label IDs             | post     |
| `sdk.updateWorkItem(issueId, changes)`                 | JSON changes                   | post     |
| `sdk.createWorkItem(data)`                             | JSON creation payload          | post     |
| `sdk.http({url,method,headers?,body?,credential_id?})` | Broker-authorized HTTP request | post     |

The parent POSTs JSON-RPC 2.0 `{jsonrpc:"2.0",id:1,method:"getWorkItem",params:[]}` with `Authorization: Bearer <broker.token>` and `X-Workflow-Execution-Id`. IDs start at 1 per script step and increase to at most 20. Django additionally enforces an aggregate budget of 20 SDK actions across the entire multi-step workflow execution, including reads and failed calls; the effective limit is the intersection of both budgets. RPCs are dispatched serially in ID order even if JS uses `Promise.all`. Response must be `{jsonrpc:"2.0",id,result}`; any broker error or malformed response fails the execution. Broker error internals never enter JS. Django validates method parameters, capability expiry/run/lease/step, actor permissions, project scope, pre read-only policy, dry-run behavior, and action idempotency. HTTP permissions, named credential injection, SSRF/DNS pinning, and header redaction also belong to Django. The runner never issues user HTTP requests directly.

`WORKFLOW_RUNNER_BROKER_ORIGIN` is one trusted configured origin, default `http://api:8000`. Execute requests may only use that origin and the exact `/api/internal/workflow-runner/rpc/` path, without query, fragment, or URL credentials. Redirects fail. Do not configure this origin from user input. The broker capability and service token are parent-only: no child IPC, environment, JS context, or runtime globals contain them. Parent additionally redacts exact token reflections in broker results/logs/errors.

## Django HTTP transport and recovery

RPC callbacks terminate at the Django **API** endpoint. Celery schedules post executions and calls the Node service, but does not execute SDK HTTP requests directly in its prefork daemon. `workflow_sdk.py` calls `workflow_http_transport.bounded_http()` from the API HTTP worker. The helper starts a disposable Python process with multiprocessing **spawn**, so it does not inherit the worker's database sockets/locks through fork. A parent-owned **5-second transport deadline** covers imports, DNS, TLS, response headers and streamed body; cleanup terminates/kills, joins and closes the child and pipes. Framed bytes are bounded JSON, not an untrusted pickle payload. Direct use from a daemon process fails closed.

The helper uses SSRF-safe `pinned_fetch`, one attempt, DNS pinning, and no redirect following. Raw HTTP body is capped at 64 KiB; the SDK returns at most 8192 characters after credential/query/sensitive-field redaction. Dry-run validates policy and DNS in the bounded helper without sending HTTP. The Node step's own 5-second wall timeout is independent: cancelling the Runner does not prove the external request had no effect.

Django commits an HTTP `running` ledger before the socket operation. Timeout/crash/uncertain transport becomes `unknown`; neither the Runner nor outbox automatically resends it. An earlier unknown post execution blocks later queued events for that issue. Administrators must verify the external outcome and call the project execution `resolve/` endpoint with `{resolution:"completed"|"abandoned",note:"..."}` (also available in the run detail UI). Resolution records the actor/time/note, marks unknown actions accordingly, cancels unfinished steps, and permanently ends the **execution as cancelled**. It does not resume the remaining script or claim run success; later queued events may then proceed. Ordinary explicit retry is restricted to eligible failed/interrupted post executions without running/unknown actions; completed internal action results are replayed rather than written twice. There is no general external exactly-once or idempotency-key automatic retry protocol.

The complete project-level behavior, approval semantics and verification record are documented in [Project workflows](../../docs/project-workflows.md).

## Limits and isolation

Optional per-request limits may only lower these hard ceilings:

| Limit              |                      Ceiling |
| ------------------ | ---------------------------: |
| `wall_time_ms`     |                         5000 |
| `cpu_time_ms`      |                         1000 |
| `memory_bytes`     |                     33554432 |
| `stack_bytes`      |                       262144 |
| `max_rpc_calls`    |                           20 |
| `max_rpc_bytes`    | 65536 (per request/response) |
| `max_log_bytes`    |   16384 (total UTF-8 output) |
| `max_logs`         |                          100 |
| `max_result_bytes` |                       131072 |

QuickJS owns its heap/stack and interrupts CPU execution, including JSON serialization and Promise jobs. CPU budget measures active runtime slices, excluding time waiting for the broker. The supervisor enforces wall time, aborts broker traffic, SIGKILLs the child's process group, and waits for child exit before replying. Child Node heap is also capped at 128 MiB. Parent checks IPC methods/IDs/logs/RPC/result size independently. Logs and SDK limits fail closed even if JS catches their exceptions. Each request gets an independent runtime; there is no retained guest state.

QuickJS has no Node globals, process, filesystem, environment, require, fetch, WebSocket, timers or installed module loader. Dynamic imports cannot load modules. The native bridge is hidden in lexical closures and accepts only strings; guest getters/proxies are never traversed in Node. `Function`/`eval` execute inside QuickJS only, with the same budget; Node `vm` and Django eval/exec are not used. The child host code is trusted Node glue; WASM is the guest boundary. This service is not an arbitrary npm/Python runtime.

Docker uses an unprivileged UID, read-only root, ALL capabilities dropped, no-new-privileges, a small noexec tmpfs, and PID/CPU/memory limits. It has no Docker socket, host mounts or API env file. Network access exists only for the trusted supervisor to the broker; do not publish its port to the Internet. Defaults permit two concurrent children; excess requests receive 429 immediately.

## Run and deploy

```sh
pnpm install
pnpm --filter @plane/workflow-runner build
# Export values from .env.example; the service token must be >=32 characters.
pnpm --filter @plane/workflow-runner start
pnpm --filter @plane/workflow-runner test
pnpm --filter @plane/workflow-runner check
```

Generate a distinct service token with `openssl rand -hex 32`; set the same value in the root deployment env and API env. API/worker use `WORKFLOW_RUNNER_URL=http://workflow-runner:8080`, `WORKFLOW_RUNNER_SERVICE_TOKEN`, and `WORKFLOW_RUNNER_BROKER_URL=http://api:8000/api/internal/workflow-runner/rpc/`. Local standalone Node can set `WORKFLOW_RUNNER_BROKER_ORIGIN=http://localhost:8000`. Never put these values in frontend env. Missing/short tokens fail startup.

```sh
docker build -f apps/workflow-runner/Dockerfile -t plane-workflow-runner:local .
docker compose -f docker-compose-local.yml up -d --build workflow-runner
docker compose -f docker-compose-test.yml up -d --build --wait workflow-runner
```

For a local session, generate one token without printing or inspecting existing secrets, then recreate the API/worker processes so they receive the same value:

```sh
export WORKFLOW_RUNNER_SERVICE_TOKEN="$(openssl rand -hex 32)"
docker compose -f docker-compose-local.yml up -d --build --wait workflow-runner
docker compose -f docker-compose-local.yml up -d --no-deps --force-recreate api worker beat-worker
```

The exported value is session-only. For persistence, save a newly generated value in the root private `.env` (and keep it out of git); avoid rotating it on every restart. The compose service environment supplies it to API/worker as well as the runner.

Django HTTP credentials use `WORKFLOW_CREDENTIAL_KEY_ID` and `WORKFLOW_CREDENTIAL_KEY`. Rotation sets a new current ID/key and retains old ID/key pairs in the JSON dictionary `WORKFLOW_CREDENTIAL_PREVIOUS_KEYS` until all old credentials have been replaced. These settings go only to API/worker. Broker capabilities use Django signing with a dedicated salt, not an extra runner signing key.

Root local/production and community compose files include the service. Community deployment needs a runner image built/published for the same `APP_RELEASE`; override `WORKFLOW_RUNNER_IMAGE` for a private registry. The runner receives only service token, broker origin and concurrency config; API-only signing/encryption keys remain in API/worker.

The test compose service is a real runner with a public test-only service token on its isolated test network; API tests use broker origin `http://api-tests:8000`. Django integration tests must bind their temporary broker server to `0.0.0.0:8000`. This token is not a production default.

The Node test suite uses the actual compiled child, real QuickJS-WASM and a local HTTP broker. It covers async success/false/throw/invalid result, CPU/wall/memory/stack limits, log/RPC/result caps, pre writes, module/Node/network absence, forged IPC, prototype/serialization tampering, broker redirects/token reflection, ordered parallel RPC, unexpected child exit, HTTP authorization and capacity. Django tests separately verify scope, lease, dry-run and real broker behavior.
