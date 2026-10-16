import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { ChartXAxisProperty } from "@plane/types";
import { InsightEntity } from "./insight-entity";
const id = "00386379-402e-4f34-a085-61a0862b8a58";
it.each([
  [ChartXAxisProperty.ASSIGNEES, `/test/profile/${id}/`],
  [ChartXAxisProperty.CREATED_BY, `/test/profile/${id}/`],
  [ChartXAxisProperty.PROJECTS, `/test/projects/${id}/issues/`],
  [ChartXAxisProperty.CYCLES, `/test/projects/project/cycles/${id}/`],
  [ChartXAxisProperty.MODULES, `/test/projects/project/modules/${id}/`],
])("uses real IDs and icons for %s", (axis, href) => {
  render(
    <MemoryRouter>
      <InsightEntity axis={axis} id={id} name="Entity" slug="test" projectId="project" />
    </MemoryRouter>
  );
  expect(screen.getByRole("link").getAttribute("href")).toBe(href);
  expect(screen.getByRole("link").querySelector("svg")).not.toBeNull();
});
it("does not create broken routes for missing associations", () => {
  render(
    <MemoryRouter>
      <InsightEntity axis={ChartXAxisProperty.ASSIGNEES} id="none" name="未分配" slug="test" />
    </MemoryRouter>
  );
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText("未分配")).toBeDefined();
});
