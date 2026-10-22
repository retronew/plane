/** Build a credential-free, instance-bound MCP connection. */
export function mcpConfig(value, { allowLocal = false } = {}) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("Plane instance must be an origin without credentials, path, query or fragment");
  if (
    url.protocol !== "https:" &&
    !(allowLocal && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error("Plane instance must use HTTPS (HTTP loopback is only allowed for explicit local tests)");
  return {
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      plane: {
        type: "streamable-http",
        url: `${url.origin}/mcp`,
        extensions: { "com.openai": { auth: { type: "oauth", baseScopes: ["plane:read", "plane:write"] } } },
      },
    },
  };
}
