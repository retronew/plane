import { describe, expect, it, vi } from "vitest";
import type { IIssueLabel, IState, IUserLite, TIssue } from "@plane/types";
import { buildPropertyMenuItems } from "./property-menu-items";

const issue = {
  id: "issue",
  project_id: "project",
  state_id: "todo",
  priority: "low",
  assignee_ids: ["ann"],
  label_ids: [],
} as unknown as TIssue;

const sources = {
  states: [
    { id: "todo", name: "Todo", group: "unstarted", color: "#000" },
    { id: "done", name: "Done", group: "completed", color: "#0f0" },
  ] as IState[],
  members: [
    { id: "ann", display_name: "Ann", avatar_url: "" },
    { id: "bob", display_name: "Bob", avatar_url: "" },
  ] as IUserLite[],
  labels: [{ id: "bug", name: "Bug", color: "#f00" }] as IIssueLabel[],
  cycles: [{ id: "c1", name: "Sprint 1" }],
  modules: [{ id: "m1", name: "Auth" }],
  priorityTitles: [
    { key: "high" as const, title: "High" },
    { key: "low" as const, title: "Low" },
  ],
};

const build = (overrides: Partial<Parameters<typeof buildPropertyMenuItems>[0]> = {}) => {
  const onUpdate = vi.fn();
  const membership = { setCycle: vi.fn(), changeModules: vi.fn() };
  const items = buildPropertyMenuItems({
    issue,
    isEditingAllowed: true,
    onUpdate,
    membership,
    now: new Date(2026, 9, 28, 12),
    locale: "en-US",
    t: (key) => key,
    sources,
    ...overrides,
  });
  const byKey = (key: string) => items.find((item) => item.key === key)!;
  return { items, byKey, onUpdate, membership };
};

describe("buildPropertyMenuItems", () => {
  it("makes the long pick lists searchable", () => {
    const { items } = build();
    expect(items.filter((item) => item.searchable).map((item) => item.key)).toEqual([
      "state",
      "assignees",
      "labels",
      "cycle",
      "modules",
    ]);
  });

  it("sets the due date from today, tomorrow and next-week presets, and clears it", () => {
    const { byKey, onUpdate } = build();
    const presets = byKey("due-date").nestedMenuItems!;
    presets[1].action();
    expect(onUpdate).toHaveBeenLastCalledWith({ target_date: "2026-10-29" });
    presets[2].action();
    expect(onUpdate).toHaveBeenLastCalledWith({ target_date: "2026-11-04" });
    // nothing to clear while the work item has no due date
    expect(presets.at(-1)?.shouldRender).toBe(false);
  });

  it("moves the work item between cycles and toggles module membership", () => {
    const { byKey, membership } = build();
    const [none, sprint] = byKey("cycle").nestedMenuItems!;
    expect(none.selected).toBe(true);
    none.action();
    expect(membership.setCycle).not.toHaveBeenCalled();
    sprint.action();
    expect(membership.setCycle).toHaveBeenCalledWith("c1");
    byKey("modules").nestedMenuItems![0].action();
    expect(membership.changeModules).toHaveBeenCalledWith(["m1"], []);
  });

  it("offers state, priority, assignee and label submenus in one section", () => {
    const { items } = build();
    expect(items.map((item) => item.key)).toEqual([
      "state",
      "priority",
      "assignees",
      "labels",
      "due-date",
      "cycle",
      "modules",
    ]);
    expect(new Set(items.map((item) => item.section)).size).toBe(1);
    expect(items.every((item) => item.shouldRender)).toBe(true);
  });

  it("checks the current value and updates on a different pick", () => {
    const { byKey, onUpdate } = build();
    const states = byKey("state").nestedMenuItems!;
    expect(states.map((item) => item.selected)).toEqual([true, false]);
    states[0].action();
    expect(onUpdate).not.toHaveBeenCalled();
    states[1].action();
    expect(onUpdate).toHaveBeenCalledWith({ state_id: "done" });

    byKey("priority").nestedMenuItems![0].action();
    expect(onUpdate).toHaveBeenLastCalledWith({ priority: "high" });
  });

  it("toggles assignees and labels in place without closing the menu", () => {
    const { byKey, onUpdate } = build();
    const [ann, bob] = byKey("assignees").nestedMenuItems!;
    // multi-select rows render as checkboxes, which keep the menu open
    expect([ann.checked, bob.checked]).toEqual([true, false]);
    ann.action();
    expect(onUpdate).toHaveBeenLastCalledWith({ assignee_ids: [] });
    bob.action();
    expect(onUpdate).toHaveBeenLastCalledWith({ assignee_ids: ["ann", "bob"] });
    byKey("labels").nestedMenuItems![0].action();
    expect(onUpdate).toHaveBeenLastCalledWith({ label_ids: ["bug"] });
  });

  it("hides the submenus when editing is not allowed or there is no update handler", () => {
    expect(build({ isEditingAllowed: false }).items.some((item) => item.shouldRender)).toBe(false);
    expect(build({ onUpdate: undefined }).items.some((item) => item.shouldRender)).toBe(false);
  });

  it("hides a submenu whose list is empty", () => {
    const { byKey } = build({ sources: { ...sources, labels: [] } });
    expect(byKey("labels").shouldRender).toBe(false);
  });
});
