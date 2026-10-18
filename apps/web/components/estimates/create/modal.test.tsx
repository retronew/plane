import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateEstimateModal } from "./modal";
const state = vi.hoisted(() => ({ createEstimate: vi.fn() }));
vi.mock("@/hooks/store/estimates", () => ({ useProjectEstimates: () => state }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
beforeEach(() => {
  state.createEstimate.mockReset().mockResolvedValue({});
});
const open = () =>
  render(<CreateEstimateModal workspaceSlug="test" projectId="project" isOpen handleClose={vi.fn()} />);
const choose = async (name: string) => {
  const combo = screen.getByRole("combobox", { name: "project_settings.estimates.create.choose_template" });
  fireEvent.click(combo);
  const option = await screen.findByRole("option", { name: new RegExp(name) });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
  await waitFor(() => expect(combo.textContent).toContain(name));
};
it("offers only presets with descriptions and values, then creates the selected numeric sequence", async () => {
  open();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("list")).toBeNull();
  fireEvent.click(screen.getByRole("combobox"));
  expect(await screen.findAllByRole("option")).toHaveLength(3);
  expect(screen.queryByRole("option", { name: /custom/ })).toBeNull();
  const linear = screen.getByRole("option", { name: /systems.points.linear/ });
  expect(linear.textContent).toContain("1, 2, 3, 4, 5, 6");
  expect(linear.textContent).toContain("project_settings.estimates.create.template_help.linear");
  fireEvent.pointerDown(linear, { pointerType: "mouse", button: 0 });
  fireEvent.click(linear);
  fireEvent.click(screen.getByRole("button", { name: "project_settings.estimates.create.label" }));
  await waitFor(() =>
    expect(state.createEstimate).toHaveBeenCalledWith("test", "project", {
      estimate: { name: "Points", type: "points", last_used: true },
      estimate_points: [1, 2, 3, 4, 5, 6].map((value) => ({ id: undefined, key: value, value: String(value) })),
    })
  );
});
it("resets the template when switching systems and persists category values unchanged", async () => {
  open();
  await choose("project_settings.estimates.systems.points.squares");
  fireEvent.click(screen.getByLabelText("project_settings.estimates.systems.categories.label"));
  expect(screen.getByRole("combobox").textContent).toContain("systems.categories.t_shirt_sizes");
  fireEvent.click(screen.getByRole("combobox"));
  expect(await screen.findAllByRole("option")).toHaveLength(2);
  expect(screen.queryByRole("option", { name: /systems.points/ })).toBeNull();
  const category = screen.getByRole("option", { name: /systems.categories.easy_to_hard/ });
  fireEvent.pointerDown(category, { pointerType: "mouse", button: 0 });
  fireEvent.click(category);
  fireEvent.click(screen.getByRole("button", { name: "project_settings.estimates.create.label" }));
  await waitFor(() =>
    expect(state.createEstimate).toHaveBeenCalledWith("test", "project", {
      estimate: { name: "Categories", type: "categories", last_used: true },
      estimate_points: ["Easy", "Medium", "Hard", "Very Hard"].map((value, index) => ({
        id: undefined,
        key: index + 1,
        value,
      })),
    })
  );
});
it("retains the selection after failure and supports retry", async () => {
  state.createEstimate.mockRejectedValueOnce(new Error("offline"));
  open();
  await choose("project_settings.estimates.systems.points.linear");
  const submit = screen.getByRole("button", { name: "project_settings.estimates.create.label" });
  fireEvent.click(submit);
  await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole("combobox").textContent).toContain("systems.points.linear");
  fireEvent.click(submit);
  await waitFor(() => expect(state.createEstimate).toHaveBeenCalledTimes(2));
});
it("blocks duplicate submits and changes during saving, and resets when reopened", async () => {
  let finish!: () => void;
  state.createEstimate.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const close = vi.fn();
  const props = { workspaceSlug: "test", projectId: "project", handleClose: close };
  const { rerender } = render(<CreateEstimateModal {...props} isOpen />);
  await choose("project_settings.estimates.systems.points.squares");
  fireEvent.click(screen.getByRole("button", { name: "project_settings.estimates.create.label" }));
  fireEvent.click(screen.getByRole("button", { name: "common.creating" }));
  expect(state.createEstimate).toHaveBeenCalledOnce();
  expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getAllByRole("radio").every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
  finish();
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  rerender(<CreateEstimateModal {...props} isOpen={false} />);
  rerender(<CreateEstimateModal {...props} isOpen />);
  expect(screen.getByRole("combobox").textContent).toContain("systems.points.fibonacci");
});

it("ignores a previous project's completion after switching targets", async () => {
  let finish!: () => void;
  state.createEstimate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const close = vi.fn();
  const { rerender } = render(<CreateEstimateModal workspaceSlug="test" projectId="old" isOpen handleClose={close} />);
  fireEvent.click(screen.getByRole("button", { name: "project_settings.estimates.create.label" }));
  rerender(<CreateEstimateModal workspaceSlug="test" projectId="new" isOpen handleClose={close} />);
  expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(false);
  await act(async () => finish());
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "project_settings.estimates.create.label" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(state.createEstimate.mock.calls[1][1]).toBe("new");
});
it("does not let a pending request close a reopened dialog", async () => {
  let finish!: () => void;
  state.createEstimate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const close = vi.fn();
  const props = { workspaceSlug: "test", projectId: "project", handleClose: close };
  const { rerender } = render(<CreateEstimateModal {...props} isOpen />);
  fireEvent.click(screen.getByRole("button", { name: "project_settings.estimates.create.label" }));
  rerender(<CreateEstimateModal {...props} isOpen={false} />);
  rerender(<CreateEstimateModal {...props} isOpen />);
  await act(async () => finish());
  expect(close).not.toHaveBeenCalled();
  expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(false);
});
