import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectCategoryBadges, ProjectCategoryFields } from "./project-fields";
const state = vi.hoisted(() => ({
  enabled: true,
  onStatus: vi.fn(),
  onLabels: vi.fn(),
  canCreate: true,
  save: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => state.canCreate }) }));
vi.mock("@/services/workspace-configuration.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/workspace-configuration.service")>();
  return { ...actual, workspaceConfigurationService: { save: state.save } };
});
vi.mock("swr", () => ({
  default: (key: string) => ({
    mutate: state.refresh,
    data: key.startsWith("project-state-settings:")
      ? { enabled: state.enabled }
      : key.includes("/status")
        ? [
            { id: "draft", kind: "status", name: "Draft", group: "draft", color: "#999999", is_default: true },
            { id: "doing", kind: "status", name: "Doing", group: "execution", color: "#0088ff", is_default: false },
          ]
        : [{ id: "product", kind: "label", name: "Product", color: "#ff8800" }],
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.enabled = true;
  state.canCreate = true;
  state.refresh.mockResolvedValue(undefined);
  state.save.mockResolvedValue({ id: "created", name: "New label", color: "#60646C" });
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: () => undefined });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 320, 240));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});
afterEach(() => vi.restoreAllMocks());
function setup(disabled = false) {
  return render(
    <ProjectCategoryFields
      compact
      workspaceSlug="workspace"
      labels={[]}
      disabled={disabled}
      onStatus={state.onStatus}
      onLabels={state.onLabels}
    >
      <button type="button">Visibility</button>
    </ProjectCategoryFields>
  );
}
it("keeps checkbox membership current and removes every duplicate selected ID", () => {
  const labels = ["unknown", "product", "product"];
  const props = { workspaceSlug: "workspace", labels, onStatus: state.onStatus, onLabels: state.onLabels };
  const { rerender } = render(<ProjectCategoryFields {...props} />);
  const control = screen.getByRole("checkbox", { name: "Product" });
  expect(control.getAttribute("aria-checked")).toBe("true");
  const input = control.parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error("Expected checkbox input");
  fireEvent.click(input);
  expect(state.onLabels).toHaveBeenCalledWith(["unknown"]);
  labels.splice(1);
  rerender(<ProjectCategoryFields {...props} />);
  expect(screen.getByRole("checkbox", { name: "Product" }).getAttribute("aria-checked")).toBe("false");
});
it("keeps status before labels and ignores duplicate or unknown selected IDs in badges", () => {
  const labels = ["unknown", "product", "product"];
  const { container, rerender } = render(
    <ProjectCategoryBadges workspaceSlug="workspace" status="doing" labels={labels} />
  );
  expect(container.textContent).toBe("DoingProduct");
  labels.splice(1);
  rerender(<ProjectCategoryBadges workspaceSlug="workspace" status="doing" labels={labels} />);
  expect(container.textContent).toBe("Doing");
  rerender(<ProjectCategoryBadges workspaceSlug="workspace" />);
  expect(container.textContent).toBe("");
});
it("keeps the inherited default state and allows choosing another status", async () => {
  setup();
  expect(screen.getAllByRole("button").map((e) => e.textContent)).toEqual(["Draft", "Visibility", "labels"]);
  fireEvent.click(screen.getByRole("button", { name: /Draft/ }));
  fireEvent.click(await screen.findByRole("option", { name: "Doing" }));
  await waitFor(() => expect(state.onStatus).toHaveBeenCalledWith("doing"));
});
it("supports selecting workspace project labels through the compact picker", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "labels" }));
  fireEvent.click(await screen.findByRole("option", { name: "Product" }));
  await waitFor(() => expect(state.onLabels).toHaveBeenCalledWith(["product"]));
});
it("hides project states when the workspace disables them", () => {
  state.enabled = false;
  setup();
  expect(screen.queryByRole("button", { name: /Draft/ })).toBeNull();
  expect(screen.getByRole("button", { name: "labels" })).toBeTruthy();
});

it("searches states without reordering the workflow", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: /Draft/ }));
  const search = await screen.findByPlaceholderText("common.search.label");
  fireEvent.change(search, { target: { value: "Doing" } });
  await waitFor(() => expect(screen.queryByRole("option", { name: "Draft" })).toBeNull());
  expect(screen.getByRole("option", { name: "Doing" })).toBeTruthy();
});
it("creates an unmatched project label and selects it", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "labels" }));
  const search = await screen.findByPlaceholderText("property_select.search_labels");
  fireEvent.change(search, { target: { value: "New label" } });
  fireEvent.click(await screen.findByRole("button", { name: "add_label_to_labels" }));
  await waitFor(() => expect(state.onLabels).toHaveBeenCalledWith(["created"]));
  expect(state.save).toHaveBeenCalledWith("workspace", "project-categories/label", {
    name: "New label",
    color: "#60646C",
  });
  expect(state.refresh).toHaveBeenCalled();
});
it("does not offer label creation without workspace admin permission", async () => {
  state.canCreate = false;
  setup();
  fireEvent.click(screen.getByRole("button", { name: "labels" }));
  const search = await screen.findByPlaceholderText("property_select.search_labels");
  fireEvent.change(search, { target: { value: "New label" } });
  await screen.findByText("no_matching_labels");
  expect(screen.queryByRole("button", { name: "add_label_to_labels" })).toBeNull();
  expect(state.save).not.toHaveBeenCalled();
});
