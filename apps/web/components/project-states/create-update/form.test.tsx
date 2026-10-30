import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StateForm } from "./form";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => vi.unstubAllGlobals());
it("saves only a progress preset, preserves the group and can restore automatic icons", async () => {
  const submit = vi.fn().mockResolvedValue({ status: "success" });
  render(
    <StateForm
      colorPickerInitiallyOpen
      data={{ name: "Review", group: "started", color: "#60646c" }}
      onSubmit={submit}
      onCancel={vi.fn()}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  fireEvent.click(await screen.findByRole("button", { name: "web.state_icon_started_25" }));
  expect(screen.queryByRole("textbox", { name: "Search icons" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ icon: "started-25", group: "started" }))
  );
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.color_picker.open" }));
  fireEvent.click(await screen.findByRole("button", { name: "web.state_icon_auto" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ icon: null, group: "started" }))
  );
});

it("resets a selected swatch to the stronger group default", async () => {
  const submit = vi.fn().mockResolvedValue({ status: "success" });
  render(
    <StateForm
      colorPickerInitiallyOpen
      data={{ name: "Review", group: "started", color: "#0693e3" }}
      onSubmit={submit}
      onCancel={vi.fn()}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  fireEvent.click(await screen.findByRole("button", { name: "#0693e3" }));
  expect(screen.getByRole("button", { name: "#0693e3" }).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ color: "#B77900" })));
});

it("resets a custom hex color from the explicit reset action", async () => {
  const submit = vi.fn().mockResolvedValue({ status: "success" });
  render(
    <StateForm
      colorPickerInitiallyOpen
      data={{ name: "Review", group: "started", color: "#663399" }}
      onSubmit={submit}
      onCancel={vi.fn()}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  fireEvent.click(await screen.findByRole("button", { name: "web.state_color_reset" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ color: "#B77900" })));
});

it("validates blank names and submits a trimmed name with the description", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  const submit = vi.fn().mockResolvedValue({ status: "success" });
  render(
    <StateForm
      data={{ name: "", color: "#60646c" }}
      onSubmit={submit}
      onCancel={vi.fn()}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  const name = screen.getByPlaceholderText("web.name");
  fireEvent.change(name, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: "  Ready  " } });
  fireEvent.change(screen.getByPlaceholderText("web.describe_this_state_for_your_members"), {
    target: { value: "Approved" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ready", description: "Approved", color: "#60646c" })
    )
  );
});

it("uses form submission, blocks duplicate saves and retains edits on failure", async () => {
  let finish!: (result: { status: string }) => void;
  const submit = vi.fn(
    () =>
      new Promise<{ status: string }>((resolve) => {
        finish = resolve;
      })
  );
  const cancel = vi.fn();
  render(
    <StateForm
      data={{ name: "Ready", color: "#60646c" }}
      onSubmit={submit}
      onCancel={cancel}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  const name = screen.getByRole("textbox", { name: "web.name" });
  const form = name.closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(submit).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  finish({ status: "error" });
  await screen.findByRole("alert");
  expect((name as HTMLInputElement).value).toBe("Ready");
  fireEvent.keyDown(name, { key: "Escape" });
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("does not steal focus during edit and cancels color changes without saving", async () => {
  const submit = vi.fn();
  const cancel = vi.fn();
  const initial = { id: "state-1", name: "Ready", color: "#60646c" };
  const { unmount } = render(
    <StateForm data={initial} onSubmit={submit} onCancel={cancel} buttonDisabled={false} buttonTitle="Save" />
  );
  expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "web.name" }));
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.color_picker.open" }));
  fireEvent.click(await screen.findByRole("button", { name: "#0693e3" }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.cancel" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
  unmount();
  render(<StateForm data={initial} onSubmit={submit} onCancel={cancel} buttonDisabled={false} buttonTitle="Save" />);
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.color_picker.open" }));
  const hex = await screen.findByRole("textbox", { name: "aria_labels.color_picker.hex_input" });
  expect((hex as HTMLInputElement).value).toBe("60646c");
});

it("can open directly in color-edit mode without focusing the name", async () => {
  render(
    <StateForm
      colorPickerInitiallyOpen
      data={{ name: "Ready", color: "#60646c" }}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  expect(await screen.findByRole("button", { name: "#0693e3" })).toBeTruthy();
  expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "web.name" }));
});
