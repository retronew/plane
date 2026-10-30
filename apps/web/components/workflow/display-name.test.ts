import { expect, it } from "vitest";
import type { TProjectWorkflow } from "@plane/types";
import { workflowDisplayName } from "./display-name";

it("localizes only the system default name and preserves custom names", () => {
  expect(workflowDisplayName({ id: "default", name: "Default workflow" } as TProjectWorkflow, "默认工作流")).toBe(
    "默认工作流"
  );
  expect(
    workflowDisplayName({ id: "uuid", is_default: true, name: "Default workflow" } as TProjectWorkflow, "默认工作流")
  ).toBe("默认工作流");
  expect(
    workflowDisplayName({ id: "uuid", is_default: false, name: "Default workflow" } as TProjectWorkflow, "默认工作流")
  ).toBe("Default workflow");
  expect(workflowDisplayName({ id: "default", name: "团队审批" } as TProjectWorkflow, "默认工作流")).toBe("团队审批");
});
