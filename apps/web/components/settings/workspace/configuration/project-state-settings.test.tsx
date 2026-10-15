import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProjectStateSettings, PROJECT_PHASES } from "./project-state-settings";

const settings = vi.hoisted(() => ({ enabled: false }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ fetchWorkspaces: vi.fn() }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ fetchProjects: vi.fn() }) }));
vi.mock("swr", () => ({
  default: () => ({ data: settings, mutate: vi.fn() }),
  useSWRConfig: () => ({ mutate: vi.fn() }),
}));
vi.mock("./category-manager", () => ({
  CategoryManager: ({ group }: { group: string }) => <div>{group}</div>,
}));
vi.mock("@plane/blocks/empty-state", () => ({
  EmptyStateCompact: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

it("keeps the state heading and explanation visible for both disabled and enabled states", () => {
  settings.enabled = false;
  const view = render(<ProjectStateSettings />);
  const section = screen.getByRole("region", { name: "web.project_states_heading" });
  expect(within(section).getByRole("heading", { name: "web.project_states_heading" })).toBeTruthy();
  expect(within(section).getByText("web.project_statuses_description")).toBeTruthy();
  expect(within(section).getByText("web.project_states_disabled_description")).toBeTruthy();
  settings.enabled = true;
  view.rerender(<ProjectStateSettings />);
  expect(within(section).getByRole("heading", { name: "web.project_states_heading" })).toBeTruthy();
  expect(within(section).queryByText("web.project_states_disabled_description")).toBeNull();
  for (const phase of PROJECT_PHASES) expect(within(section).getByText(phase)).toBeTruthy();
});
