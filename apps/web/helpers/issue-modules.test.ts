import { expect, it } from "vitest";
import { observable, runInAction } from "mobx";
import { getIssueModuleChanges } from "./issue-modules";

it("preserves removal and addition order while collapsing duplicate IDs", () => {
  const current = ["old-b", "shared", "old-a", "old-b"];
  const next = ["new-b", "shared", "new-a", "new-b"];
  expect(getIssueModuleChanges(current, next)).toEqual({
    modulesToAdd: ["new-b", "new-a"],
    modulesToRemove: ["old-b", "old-a"],
  });
  expect(current).toEqual(["old-b", "shared", "old-a", "old-b"]);
  expect(next).toEqual(["new-b", "shared", "new-a", "new-b"]);
});

it("supports missing modules, removing all modules and an unchanged selection", () => {
  expect(getIssueModuleChanges(undefined, ["a"])).toEqual({ modulesToAdd: ["a"], modulesToRemove: [] });
  expect(getIssueModuleChanges(["a"], [])).toEqual({ modulesToAdd: [], modulesToRemove: ["a"] });
  expect(getIssueModuleChanges(["a", "b"], ["b", "a"])).toEqual({ modulesToAdd: [], modulesToRemove: [] });
});

it("reads observable IDs at each call after in-place updates", () => {
  const ids = observable.array(["a"]);
  expect(getIssueModuleChanges(ids, ["b"])).toEqual({ modulesToAdd: ["b"], modulesToRemove: ["a"] });
  runInAction(() => ids.replace(["b"]));
  expect(getIssueModuleChanges(ids, ["b"])).toEqual({ modulesToAdd: [], modulesToRemove: [] });
});
