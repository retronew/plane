import test from "node:test";
import assert from "node:assert/strict";
import { mcpConfig } from "./mcp-config.mjs";

test("instance binding rejects credentials and non-origin URLs", () => {
  for (const value of [
    "http://remote.test",
    "https://user:secret@plane.test",
    "https://plane.test/path",
    "https://plane.test/?token=x",
    "https://plane.test/#x",
    "file:///tmp/foo",
  ]) {
    assert.throws(() => mcpConfig(value));
  }
});
test("OpenAI declares read-only OAuth with dynamic registration without changing the compatibility transport", () => {
  const config = mcpConfig("https://plane.test", { openai: true });
  assert.deepEqual(config.mcpServers.plane, {
    type: "http",
    url: "https://plane.test/mcp",
    extensions: {
      "com.openai": {
        auth: { type: "oauth", client: { mode: "dcr" }, baseScopes: ["plane:read"] },
      },
    },
  });
  assert.ok(!("extensions" in mcpConfig("https://plane.test").mcpServers.plane));
  assert.throws(() => mcpConfig("http://remote.test", { openai: true }));
});

test("local test binding is explicit and never permits remote HTTP", () => {
  assert.throws(() => mcpConfig("http://localhost:8000"));
  assert.equal(
    mcpConfig("http://localhost:8000", { allowLocal: true }).mcpServers.plane.url,
    "http://localhost:8000/mcp"
  );
  assert.throws(() => mcpConfig("http://remote.test", { allowLocal: true }));
});
