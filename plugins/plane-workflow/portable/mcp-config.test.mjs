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
test("local test binding is explicit and never permits remote HTTP", () => {
  assert.throws(() => mcpConfig("http://localhost:8000"));
  assert.equal(
    mcpConfig("http://localhost:8000", { allowLocal: true }).mcpServers.plane.url,
    "http://localhost:8000/mcp"
  );
  assert.throws(() => mcpConfig("http://remote.test", { allowLocal: true }));
});
