/** Build a credential-free, instance-bound MCP connection. */
export function mcpConfig(value, { allowLocal = false, openai = false } = {}) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("Plane instance must be an origin without credentials, path, query or fragment");
  if (
    url.protocol !== "https:" &&
    !(allowLocal && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error("Plane instance must use HTTPS (HTTP loopback is only allowed for explicit local tests)");
  // Keep the desktop compatibility transport; OpenAI also needs an explicit auth declaration.
  // Endpoint URLs are discovered from the instance, and public clients register through DCR.
  return {
    mcpServers: {
      plane: {
        type: "http",
        url: `${url.origin}/mcp`,
        ...(openai && {
          extensions: {
            "com.openai": {
              auth: { type: "oauth", client: { mode: "dcr" }, baseScopes: ["plane:read"] },
            },
          },
        }),
      },
    },
  };
}
