# Webhooks

Plane sends an HTTP `POST` to your URL whenever something you subscribed to changes. Use webhooks for automation that runs without anyone watching: syncing to another system, triggering a CI job, or waking up an AI agent.

## Personal and workspace webhooks

| Scope                | Who can create       | Receives                                                                                                                                        |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `personal` (default) | Any workspace member | Events from projects the owner is an active member of. Guests in projects that do not open all features to guests only get their own work items |
| `workspace`          | Workspace admins     | Every event in the workspace                                                                                                                    |

Manage them with the public API (`/api/v1/workspaces/{slug}/webhooks/`), the `webhook` MCP tool, or, for workspace webhooks, in workspace settings.

```bash
curl -X POST "https://plane.example.com/api/v1/workspaces/<slug>/webhooks/" \
  -H "X-Api-Key: <your key>" -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.example.com/plane", "events": ["issue.assigned", "issue.state_changed"]}'
```

The response contains `secret_key`. It is shown only here and after `POST .../webhooks/{id}/regenerate-secret/`, so store it right away.

| Endpoint                                   | Purpose                                                       |
| ------------------------------------------ | ------------------------------------------------------------- |
| `GET /webhooks/`                           | Your personal webhooks; admins also see workspace webhooks    |
| `POST /webhooks/`                          | Create. Body: `url`, `events` or the boolean toggles, `scope` |
| `GET` / `PATCH` / `DELETE /webhooks/{id}/` | Read, update (`is_active: false` pauses), delete              |
| `POST /webhooks/{id}/regenerate-secret/`   | New signing secret; the old one stops working                 |
| `GET /webhooks/{id}/logs/`                 | Recent deliveries with status codes                           |
| `POST /webhooks/{id}/test/`                | Queue a `ping` delivery                                       |

## Events

Subscribe with `events`. A broad name matches every action on that object; a specific name matches only that action. When `events` is empty, the legacy boolean toggles (`project`, `issue`, `cycle`, `module`, `issue_comment`) apply.

| Event                                                                 | Fires when                                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `issue`, `issue.created`, `issue.updated`, `issue.deleted`            | A work item changes                                                                                   |
| `issue.state_changed`                                                 | A work item's state changes                                                                           |
| `issue.assigned`                                                      | A work item's assignees change                                                                        |
| `issue_comment`, `issue_comment.created` / `.updated` / `.deleted`    | A comment changes                                                                                     |
| `project`, `cycle`, `module` (+ `.created` / `.updated` / `.deleted`) | Those objects change; adding or removing work items in a cycle or module counts as `cycle` / `module` |
| `ping`                                                                | Test deliveries only                                                                                  |

One update that touches several fields sends one delivery per field.

## Payload

```json
{
  "event": "issue",
  "action": "updated",
  "event_types": ["issue", "issue.updated", "issue.state_changed"],
  "webhook_id": "…",
  "workspace_id": "…",
  "workspace_slug": "moondrop",
  "data": { "id": "…", "name": "Fix login", "state": { … }, "assignees": [ … ] },
  "activity": {
    "field": "state_id",
    "old_value": "…",
    "new_value": "…",
    "actor": { "id": "…", "display_name": "…" }
  }
}
```

`data` is the object after the change (`{"id": …}` only when it was deleted).

## Headers

| Header                  | Value                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| `X-Plane-Event`         | The base event, e.g. `issue`                                           |
| `X-Plane-Delivery`      | Unique id per delivery; use it to drop duplicates                      |
| `X-Plane-Timestamp`     | Unix seconds when the delivery was signed                              |
| `X-Plane-Signature-256` | `sha256=` + HMAC-SHA256 of `"{timestamp}.{raw body}"` with your secret |
| `X-Plane-Signature`     | Legacy: hex HMAC-SHA256 of the raw body. Kept for existing receivers   |

## Verify a delivery

Check the signature against the **raw** request body, before parsing JSON, and reject timestamps older than five minutes to stop replays.

Python:

```python
import hashlib, hmac, time

def verify(secret: str, raw_body: bytes, timestamp: str, signature: str, tolerance: int = 300) -> bool:
    if abs(time.time() - int(timestamp)) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

Node.js:

```js
import crypto from "node:crypto";

export function verify(secret, rawBody, timestamp, signature, tolerance = 300) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
  const a = Buffer.from(`sha256=${expected}`);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

## Delivery and retries

- Answer with any `2xx` within 30 seconds. Do slow work after responding.
- On a network error Plane retries up to 5 times with exponential backoff (starting around 10 minutes). After the last failure the webhook is turned off and its creator gets an email; turn it back on with `PATCH {"is_active": true}`.
- Redirects are not followed, and URLs that resolve to private or internal addresses are rejected unless the instance allows them (`WEBHOOK_ALLOWED_HOSTS`, `WEBHOOK_ALLOWED_IPS`).
- Deliveries can arrive out of order or more than once; use `X-Plane-Delivery` and the object's `updated_at` to reconcile.
