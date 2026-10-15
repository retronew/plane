import { observable, runInAction } from "mobx";
import { expect, it } from "vitest";
import type { RootStore } from "@/store/root.store";
import { ProjectsTimeLineStore } from "./projects-timeline.store";

it("binds project dates to the existing Gantt store and follows edits without reload", () => {
  const projects = observable.map([
    ["p1", { id: "p1", name: "One", sort_order: 1, start_date: "2026-10-15", target_date: "2026-10-20" }],
    ["p2", { id: "p2", name: "Two", sort_order: 2, start_date: null, target_date: null }],
  ]);
  const root = {
    projectRoot: { project: { getProjectById: (id: string) => projects.get(id) } },
  } as unknown as RootStore;
  const store = new ProjectsTimeLineStore(root);
  store.setBlockIds(["p1", "p2"]);
  expect(store.getBlockById("p1").start_date).toBe("2026-10-15");
  expect(store.getBlockById("p1").position?.width).toBeGreaterThan(0);
  expect(store.getBlockById("p2").start_date).toBeUndefined();
  runInAction(() => {
    projects.get("p1")!.target_date = "2026-10-22";
  });
  expect(store.getBlockById("p1").target_date).toBe("2026-10-22");
  store.setBlockIds(["p2"]);
  expect(store.blockIds).toEqual(["p2"]);
  expect(store.getBlockById("p2").name).toBe("Two");
});
