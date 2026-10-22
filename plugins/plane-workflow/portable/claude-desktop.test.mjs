import test from "node:test";
import assert from "node:assert/strict";
import { validateDesktopMetadata } from "./claude-desktop.mjs";

const origin = "https://plane-test.example";
const authorization = {
  issuer: origin,
  authorization_endpoint: `${origin}/auth/mcp/authorize/`,
  token_endpoint: `${origin}/auth/mcp/token/`,
  registration_endpoint: `${origin}/auth/mcp/register/`,
};
const resource = { resource: `${origin}/mcp`, authorization_servers: [origin] };

test("desktop packaging requires HTTPS with matching OAuth discovery", () => {
  validateDesktopMetadata(origin, authorization, resource);
  assert.throws(() => validateDesktopMetadata("http://localhost:8000", authorization, resource), /HTTPS/);
  for (const key of Object.keys(authorization)) {
    assert.throws(() =>
      validateDesktopMetadata(origin, { ...authorization, [key]: "http://localhost:8000" }, resource)
    );
  }
  assert.throws(() =>
    validateDesktopMetadata(origin, authorization, { ...resource, resource: "https://other.example/mcp" })
  );
  assert.throws(() =>
    validateDesktopMetadata(origin, authorization, { ...resource, authorization_servers: ["https://other.example"] })
  );
});
