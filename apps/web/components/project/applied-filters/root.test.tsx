import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProjectAppliedFiltersList } from "./root";
vi.mock("react-router", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ workspace: { getWorkspaceMemberDetails: () => undefined } }),
}));
vi.mock("@/components/settings/workspace/configuration/project-fields", () => ({
  useProjectCategories: () => ({ statuses: [], labels: [], statesEnabled: true }),
}));
const remove = vi.fn();
const clear = vi.fn();
const props = {
  appliedFilters: { priority: ["high"] },
  appliedDisplayFilters: [],
  handleClearAllFilters: clear,
  handleRemoveFilter: remove,
  handleRemoveDisplayFilter: vi.fn(),
  alwaysAllowEditing: true,
  filteredProjects: 1,
  totalProjects: 3,
};
it("keeps individual and whole-group removal distinct and shows the result count", () => {
  render(<ProjectAppliedFiltersList {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "remove web.high" }));
  expect(remove).toHaveBeenLastCalledWith("priority", "high");
  fireEvent.click(screen.getByRole("button", { name: "remove priority" }));
  expect(remove).toHaveBeenLastCalledWith("priority", null);
  fireEvent.click(screen.getByRole("button", { name: "common.clear_all" }));
  expect(clear).toHaveBeenCalledOnce();
  expect(screen.getByText("1/3")).toBeTruthy();
});
it("omits all removal controls in read-only mode and hides an empty toolbar", () => {
  const { rerender } = render(<ProjectAppliedFiltersList {...props} alwaysAllowEditing={false} />);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  rerender(<ProjectAppliedFiltersList {...props} appliedFilters={{ priority: [] }} />);
  expect(screen.queryByText("common.clear_all")).toBeNull();
});
