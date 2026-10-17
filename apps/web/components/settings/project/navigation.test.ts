import { expect, it } from "vitest";
import { GROUPED_PROJECT_SETTINGS, PROJECT_SETTINGS } from "@plane/constants";
import { EUserProjectRoles } from "@plane/types";
import { getProjectActivePath } from "../helper";

it("makes script management a single administrator project setting with a mobile title", () => {
  const entries = Object.values(GROUPED_PROJECT_SETTINGS).flat();
  expect(entries.filter((item) => item.key === "workflow_runner")).toHaveLength(1);
  expect(PROJECT_SETTINGS.workflow_runner.href).toBe("/runner");
  expect(PROJECT_SETTINGS.workflow_runner.access).toEqual([EUserProjectRoles.ADMIN]);
  expect(getProjectActivePath("/w/settings/projects/p/runner/")).toBe("web.workflow_runner.scripts");
});
