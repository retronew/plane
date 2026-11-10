import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkflowCreateTypeAction } from "./create-type-action";

const state = vi.hoisted(() => ({
  store: { refresh: vi.fn(), service: { hierarchy: vi.fn(), saveType: vi.fn() } },
  toast: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({
  Logo: () => null,
  EmojiPicker: () => null,
  getIconBackgroundStyle: () => undefined,
}));
vi.mock("@/hooks/store/use-project-workflow", () => ({ useProjectWorkflow: () => state.store }));
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  state.store.service.hierarchy.mockReset().mockResolvedValue({ default_level: 2, levels: [0, 1, 2] });
  state.store.service.saveType.mockReset().mockResolvedValue({ id: "bug", name: "Bug" });
  state.store.refresh.mockReset().mockResolvedValue(undefined);
});
async function openEditor() {
  render(<WorkflowCreateTypeAction workspaceSlug="w" projectId="p" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.types_settings.add" }));
  await screen.findByRole("dialog");
}
it("creates a type using the project default level and refreshes workflow filters", async () => {
  await openEditor();
  expect(state.store.service.hierarchy).toHaveBeenCalledWith("w", "p");
  fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: " Bug " } });
  fireEvent.submit(document.getElementById("work-item-type-form")!);
  await waitFor(() =>
    expect(state.store.service.saveType).toHaveBeenCalledWith("w", "p", {
      name: "Bug",
      description: "",
      logo_props: {},
      level: 2,
    })
  );
  expect(state.store.refresh).toHaveBeenCalledWith("w", "p");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("keeps input available after a failed create and reports the server error", async () => {
  state.store.service.saveType.mockRejectedValue({ code: "WORKFLOW_DUPLICATE_TYPE" });
  await openEditor();
  fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "Bug" } });
  fireEvent.submit(document.getElementById("work-item-type-form")!);
  await waitFor(() =>
    expect(state.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "web.workflow_errors.WORKFLOW_DUPLICATE_TYPE",
      })
    )
  );
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "name" }).value).toBe("Bug");
  expect(state.store.refresh).not.toHaveBeenCalled();
});
it("closes the saved form even when refreshing fails so retrying cannot duplicate the type", async () => {
  state.store.refresh.mockRejectedValue(new Error("network"));
  await openEditor();
  fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "Bug" } });
  fireEvent.submit(document.getElementById("work-item-type-form")!);
  await waitFor(() => expect(state.toast).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(state.store.service.saveType).toHaveBeenCalledTimes(1);
});
it("does not open or load the editor while another operation is pending", () => {
  render(<WorkflowCreateTypeAction workspaceSlug="w" projectId="p" disabled />);
  fireEvent.click(screen.getByRole("button", { name: "web.workflow_ui.types_settings.add" }));
  expect(state.store.service.hierarchy).not.toHaveBeenCalled();
});
