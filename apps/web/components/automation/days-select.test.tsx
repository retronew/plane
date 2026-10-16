import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AutomationDaysSelect } from "./days-select";
Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string, args?: { count?: number }) => (args?.count ? `${args.count} days` : key) }),
}));
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());
const pickCustom = async () => {
  fireEvent.click(screen.getByRole("combobox"));
  const option = await screen.findByRole("option", { name: "project_settings.automations.custom_days" });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
  return screen.findByRole("spinbutton");
};
it("offers day presets in stable order and accepts a custom number of days", async () => {
  const change = vi.fn().mockResolvedValue(undefined);
  render(<AutomationDaysSelect value={30} label="Archive delay" onChange={change} />);
  const input = await pickCustom();
  fireEvent.change(input, { target: { value: "45" } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(change).toHaveBeenCalledWith(45));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("rejects invalid custom days and keeps the dialog open when saving fails", async () => {
  const change = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  render(<AutomationDaysSelect value={30} label="Archive delay" onChange={change} />);
  const input = await pickCustom();
  for (const value of ["0", "366", "1.5"]) {
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText("project_settings.automations.days_validation")).toBeTruthy();
  }
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "45" } });
  fireEvent.submit(input.closest("form")!);
  expect(await screen.findByText("common.something_went_wrong")).toBeTruthy();
  expect((input as HTMLInputElement).value).toBe("45");
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
