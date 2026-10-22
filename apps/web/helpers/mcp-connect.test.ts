import { describe, expect, it } from "vitest";
import { mcpAuthorizationResumeUrl } from "./mcp-connect";

describe("MCP login return", () => {
  it("returns to the configured API origin with an opaque flow identifier", () => {
    const flow = "a".repeat(43);
    expect(mcpAuthorizationResumeUrl(flow, "http://localhost:8000/")).toBe(
      `http://localhost:8000/auth/mcp/authorize/?flow=${flow}`
    );
    expect(mcpAuthorizationResumeUrl(flow, "")).toBe(`/auth/mcp/authorize/?flow=${flow}`);
  });
  it.each([null, "", "https://attacker.invalid/", "a&redirect=evil", "a".repeat(44)])(
    "rejects an invalid flow %s",
    (flow) => {
      expect(mcpAuthorizationResumeUrl(flow, "https://plane.test")).toBeNull();
    }
  );
});
