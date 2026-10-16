import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { AutoCloseAutomation } from "./auto-close-automation";
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ currentProjectDetails: { id: "project", close_in: 7, default_state: "cancelled" } }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    projectStates: [
      { id: "cancelled", name: "Cancelled", group: "cancelled", color: "#60646c" },
      { id: "started", name: "Started", group: "started", color: "#60646c" },
    ],
  }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("react-router", async () => ({
  ...(await vi.importActual("react-router")),
  useParams: () => ({ workspaceSlug: "workspace" }),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Translation: ({ components }: { components: { settings: React.ReactNode } }) => <>{components.settings}</>,
}));
it("keeps a single cancelled state selectable and links to the current project's state settings", async () => {
  render(
    <MemoryRouter>
      <AutoCloseAutomation handleChange={vi.fn().mockResolvedValue(undefined)} />
    </MemoryRouter>
  );
  const select = screen.getByRole("combobox", { name: "project_settings.automations.auto-close.auto_close_status" });
  expect((select as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole("link").getAttribute("href")).toBe("/workspace/settings/projects/project/states/");
  fireEvent.click(select);
  expect(await screen.findAllByRole("option")).toHaveLength(1);
  expect(screen.queryByRole("option", { name: "Started" })).toBeNull();
});
