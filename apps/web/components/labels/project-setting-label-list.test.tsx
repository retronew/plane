import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProjectSettingsLabelList } from "./project-setting-label-list";
const state = vi.hoisted(() => ({
  editable: true,
  projectLabels: [{ id: "a", name: "Bug", color: "#60646c", parent: null, sort_order: 0 }],
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
}));
vi.mock("@plane/blocks/sortable", () => ({
  SortableProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SortableItem: ({ children }: { children: (props: { handleRef: () => void }) => ReactNode }) => (
    <div>{children({ handleRef: () => undefined })}</div>
  ),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test", projectId: "project" }) }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => state }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => state.editable }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./delete-label-modal", () => ({ DeleteLabelModal: () => null }));
beforeEach(() => {
  state.editable = true;
  state.createLabel.mockReset().mockResolvedValue({});
  state.updateLabel.mockReset().mockResolvedValue({});
});
it("reuses inline state layout without adding a description and saves only label fields", async () => {
  render(<ProjectSettingsLabelList />);
  fireEvent.click(screen.getByRole("button", { name: "Bug" }));
  expect(screen.queryByRole("textbox", { name: "description" })).toBeNull();
  const name = screen.getByRole("textbox", { name: "web.name" });
  expect(document.activeElement).not.toBe(name);
  fireEvent.change(name, { target: { value: "  Defect  " } });
  fireEvent.click(screen.getByRole("button", { name: "update" }));
  await waitFor(() =>
    expect(state.updateLabel).toHaveBeenCalledWith("test", "project", "a", { name: "Defect", color: "#60646c" })
  );
});
it("opens color editing directly from the icon and cancel never saves", async () => {
  const { container } = render(<ProjectSettingsLabelList />);
  fireEvent.click(container.querySelector("[data-state-color-target]")!);
  expect(await screen.findByRole("button", { name: "#0693e3" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "#0693e3" }));
  fireEvent.click(screen.getByRole("button", { name: "web.cancel" }));
  expect(state.updateLabel).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Bug" })).toBeTruthy();
});
it("retains the editor on persistence failure", async () => {
  state.updateLabel.mockRejectedValue({ name: ["LABEL_NAME_ALREADY_EXISTS"] });
  render(<ProjectSettingsLabelList />);
  fireEvent.click(screen.getByRole("button", { name: "Bug" }));
  fireEvent.click(screen.getByRole("button", { name: "update" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "label.create.already_exists");
});
it("keeps the roster readable without granting mutation controls", () => {
  state.editable = false;
  render(<ProjectSettingsLabelList />);
  expect(screen.queryByRole("button", { name: "common.add_label" })).toBeNull();
  expect((screen.getByRole("button", { name: "Bug" }) as HTMLButtonElement).disabled).toBe(true);
});
