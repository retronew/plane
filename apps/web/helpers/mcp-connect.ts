/** OAuth login resumes only at the configured API, never a user-provided URL. */
export function mcpAuthorizationResumeUrl(flow: string | null, apiBaseUrl: string): string | null {
  if (!flow || !/^[A-Za-z0-9_-]{43}$/.test(flow)) return null;
  return `${apiBaseUrl.replace(/\/$/, "")}/auth/mcp/authorize/?flow=${encodeURIComponent(flow)}`;
}

/** Navigate only after the server has validated and returned the registered callback. */
export function returnToMcpClient(target: string): void {
  window.location.assign(target);
}
