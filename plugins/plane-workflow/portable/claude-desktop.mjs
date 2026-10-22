import assert from "node:assert/strict";
import { mcpConfig } from "./mcp-config.mjs";

/** Desktop's sign-in opener requires HTTPS, including for local Code sessions. */
export function validateDesktopMetadata(origin, authorization, protectedResource) {
  const url = mcpConfig(origin).mcpServers.plane.url;
  const issuer = new URL(url).origin;
  assert.equal(authorization.issuer, issuer, "OAuth issuer must match the plugin's HTTPS origin");
  assert.equal(protectedResource.resource, url, "OAuth resource must match the plugin MCP URL");
  assert.deepEqual(protectedResource.authorization_servers, [issuer], "OAuth discovery must use the same issuer");
  for (const [key, path] of Object.entries({
    authorization_endpoint: "/auth/mcp/authorize/",
    token_endpoint: "/auth/mcp/token/",
    registration_endpoint: "/auth/mcp/register/",
  })) {
    assert.equal(authorization[key], issuer + path, `${key} must use the plugin's HTTPS origin`);
  }
}

export async function checkDesktopEndpoint(origin) {
  const issuer = new URL(mcpConfig(origin).mcpServers.plane.url).origin;
  const documents = await Promise.all(
    ["oauth-authorization-server", "oauth-protected-resource"].map(async (name) => {
      const response = await fetch(`${issuer}/.well-known/${name}`, {
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`OAuth discovery ${name} returned HTTP ${response.status}`);
      return response.json();
    })
  );
  validateDesktopMetadata(issuer, ...documents);
}
