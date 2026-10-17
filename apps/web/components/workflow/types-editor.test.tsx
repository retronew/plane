import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TypesEditor } from "./types-editor";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ Logo: () => null, EmojiPicker: () => <span>picker</span> }));
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  vi.unstubAllGlobals();
});
it("keeps dialog content through the exit animation", async () => {
  let finishAnimation!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishAnimation = resolve;
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: () => [{ finished }] });
  const props = {
    type: { name: "Task" },
    open: true,
    busy: false,
    workflows: [],
    onClose: vi.fn(),
    onClosed: vi.fn(),
    onSave: vi.fn(),
    onPreview: vi.fn(),
  };
  const { rerender } = render(<TypesEditor {...props} />);
  const dialog = screen.getByRole("dialog");
  await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));
  rerender(<TypesEditor {...props} open={false} />);
  expect(dialog.isConnected).toBe(true);
  expect(dialog.hasAttribute("data-ending-style")).toBe(true);
  expect(props.onClosed).not.toHaveBeenCalled();
  await act(async () => finishAnimation());
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  expect(props.onClosed).toHaveBeenCalled();
});
it("saves metadata then previews a workflow change using the persisted type id", async () => {
  Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: () => [] });
  const onSave = vi.fn().mockResolvedValue({ id: "persisted" }),
    onPreview = vi.fn();
  render(
    <TypesEditor
      type={{ id: "shared", name: "Task", workflow_id: null }}
      open
      busy={false}
      workflows={[]}
      onClose={vi.fn()}
      onClosed={vi.fn()}
      onSave={onSave}
      onPreview={onPreview}
    />
  );
  // Add a real choice to exercise a selected workflow without depending on other workflow metadata.
  const select = screen.getByRole("combobox");
  const option = document.createElement("option");
  option.value = "flow";
  option.textContent = "Flow";
  select.appendChild(option);
  fireEvent.change(select, { target: { value: "flow" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(onPreview).toHaveBeenCalledWith({ operation: "bind_type", type_id: "persisted", workflow_id: "flow" })
  );
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Task", description: "" }), "shared");
});
