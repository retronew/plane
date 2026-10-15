import { describe, expect, it } from "vitest";
import { GROUPED_WORKSPACE_SETTINGS, WORKSPACE_SETTINGS, WORKSPACE_SETTINGS_ACCESS } from "@plane/constants";

describe("workspace settings navigation", () => {
  it("keeps supported settings reachable without billing routes or access entries", () => {
    const items = Object.values(GROUPED_WORKSPACE_SETTINGS).flat();
    expect(items).toHaveLength(8);
    expect(items.map((item) => item.key)).toEqual(expect.arrayContaining(["export", "general", "members", "webhooks"]));
    expect(items.every((item) => WORKSPACE_SETTINGS_ACCESS[item.href])).toBe(true);
    expect(Object.keys(WORKSPACE_SETTINGS)).not.toContain("billing-and-plans");
    expect(WORKSPACE_SETTINGS_ACCESS).not.toHaveProperty("/settings/billing");
  });
});
