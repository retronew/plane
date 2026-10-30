import { describe, expect, it, vi } from "vitest";
import { buildRelatedMenuItems } from "./related-menu-items";

vi.mock("@/components/relations", () => ({
  ISSUE_RELATION_OPTIONS: Object.fromEntries(
    ["relates_to", "blocked_by", "blocking", "duplicate"].map((key) => [
      key,
      { i18n_label: `issue.relation.${key}`, icon: () => null },
    ])
  ),
}));

const build = (overrides: Partial<Parameters<typeof buildRelatedMenuItems>[0]> = {}) => {
  const handlers = {
    openCreateSubWorkItem: vi.fn(),
    openAddExistingSubWorkItems: vi.fn(),
    openRelation: vi.fn(),
    toggleSubscription: vi.fn(),
    prefetchSubscription: vi.fn(),
  };
  const items = buildRelatedMenuItems({
    isEditingAllowed: true,
    isSubscribed: false,
    t: (key) => key,
    ...handlers,
    ...overrides,
  });
  const byKey = (key: string) => items.find((item) => item.key === key)!;
  return { items, byKey, handlers };
};

describe("buildRelatedMenuItems", () => {
  it("offers new or existing sub-work items", () => {
    const { byKey, handlers } = build();
    const [create, existing] = byKey("add-sub-work-item").nestedMenuItems!;
    create.action();
    existing.action();
    expect(handlers.openCreateSubWorkItem).toHaveBeenCalledTimes(1);
    expect(handlers.openAddExistingSubWorkItems).toHaveBeenCalledTimes(1);
  });

  it("opens the picker for each relation type", () => {
    const { byKey, handlers } = build();
    const relations = byKey("add-relation").nestedMenuItems!;
    expect(relations.map((item) => item.title)).toEqual([
      "issue.relation.relates_to",
      "issue.relation.blocked_by",
      "issue.relation.blocking",
      "issue.relation.duplicate",
    ]);
    relations[1].action();
    expect(handlers.openRelation).toHaveBeenCalledWith("blocked_by");
  });

  it("labels the subscription row by its current state and prefetches it on open", () => {
    expect(build({ isSubscribed: false }).byKey("subscription").title).toBe("common.actions.subscribe");
    expect(build({ isSubscribed: true }).byKey("subscription").title).toBe("common.actions.unsubscribe");
    const unknown = build({ isSubscribed: undefined });
    const row = unknown.byKey("subscription");
    // hidden until fetched, but still asks to be fetched when the menu opens
    expect(row.shouldRender).toBe(false);
    row.onMenuOpen?.();
    expect(unknown.handlers.prefetchSubscription).toHaveBeenCalledTimes(1);
  });

  it("hides the create rows without edit rights but keeps the subscription row", () => {
    const { byKey } = build({ isEditingAllowed: false });
    expect(byKey("add-sub-work-item").shouldRender).toBe(false);
    expect(byKey("add-relation").shouldRender).toBe(false);
    expect(byKey("subscription").shouldRender).toBe(true);
  });
});
