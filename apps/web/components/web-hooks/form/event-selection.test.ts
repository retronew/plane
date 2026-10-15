import { describe, expect, it } from "vitest";
import { getWebhookGroupEvents, normalizeWebhookEvents, toggleWebhookEvents } from "./event-selection";

describe("webhook event selection", () => {
  it("initializes new hooks with supported events and converts an existing selection", () => {
    expect(normalizeWebhookEvents()).toEqual([]);
    expect(normalizeWebhookEvents({ project: true, issue: false })).toEqual(getWebhookGroupEvents("project"));
    expect(normalizeWebhookEvents({ events: ["issue.assigned"], project: true })).toEqual(["issue.assigned"]);
  });
  it("toggles groups without changing other groups or retaining duplicate selections", () => {
    const selected = ["project.created", "issue.assigned"];
    const added = toggleWebhookEvents(selected, getWebhookGroupEvents("project"), true);
    expect(added).toHaveLength(4);
    expect(toggleWebhookEvents(added, getWebhookGroupEvents("project"), false)).toEqual(["issue.assigned"]);
    expect(toggleWebhookEvents(selected, selected, false)).toEqual([]);
  });
});
