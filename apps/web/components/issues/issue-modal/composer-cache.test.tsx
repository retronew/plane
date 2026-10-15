import { describe, expect, it } from "vitest";
import { saveComposerDraft, readComposerDraft, composerCacheKey, composerDraftContext } from "./composer-cache";
describe("temporary composer drafts", () => {
  it("keeps formal work items, draft creation and child work items in separate caches", () => {
    const draftContext = composerDraftContext(undefined, undefined, true);
    expect(draftContext).toBe("[null,null,true]");
    expect(composerDraftContext("project-1")).toBe("new");
    const draftKey = composerCacheKey("user", "workspace", draftContext);
    saveComposerDraft(draftKey, { values: { name: "Unfinished draft" }, assetIds: [] });
    expect(readComposerDraft(draftKey)?.values.name).toBe("Unfinished draft");
    expect(readComposerDraft(composerCacheKey("user", "workspace", "new"))).toBeUndefined();
    expect(
      readComposerDraft(composerCacheKey("user", "workspace", composerDraftContext("project-1", "parent-1", true)))
    ).toBeUndefined();
    saveComposerDraft(draftKey);
  });
  it("restores full content, properties and asset references", () => {
    const key = composerCacheKey("user", "workspace", "project");
    const draft = {
      values: {
        name: "Title",
        description_html: "<p>Body</p>",
        priority: "high" as const,
        project_id: "chosen",
        assignee_ids: ["member"],
      },
      assetIds: ["asset"],
    };
    saveComposerDraft(key, draft);
    expect(readComposerDraft(key)).toEqual(draft);
    for (const other of [
      composerCacheKey("other", "workspace", "project"),
      composerCacheKey("user", "other", "project"),
      composerCacheKey("user", "workspace", "other"),
    ])
      expect(readComposerDraft(other)).toBeUndefined();
    saveComposerDraft(key);
    expect(readComposerDraft(key)).toBeUndefined();
  });
  it("ignores invalid persisted data", () => {
    sessionStorage.setItem("invalid", "{");
    expect(readComposerDraft("invalid")).toBeUndefined();
  });
});

it("retains property-only changes and notifies subscribers when discarded", async () => {
  const { hasComposerContent, subscribeComposerDrafts } = await import("./composer-cache");
  expect(hasComposerContent({ values: { description_html: "<p></p>" }, assetIds: [] })).toBe(false);
  const draft = { values: { state_id: "changed-state" }, assetIds: [], hasChanges: true };
  expect(hasComposerContent(draft)).toBe(true);
  let notifications = 0;
  const unsubscribe = subscribeComposerDrafts(() => notifications++);
  saveComposerDraft("property-only", draft);
  saveComposerDraft("property-only");
  expect(notifications).toBe(2);
  unsubscribe();
  saveComposerDraft("property-only");
  expect(notifications).toBe(2);
});
