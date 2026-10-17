import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TPageInstance } from "@/store/pages/base-page";
import { PageEditorHeaderLogoPicker } from "./logo-picker";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({
  EmojiPicker: ({
    label,
    onChange,
    disabled,
  }: {
    label: React.ReactNode;
    onChange: (value: unknown) => void;
    disabled: boolean;
  }) => (
    <button disabled={disabled} onClick={() => onChange({ type: "icon", value: { name: "Star", color: "#ff0000" } })}>
      {label}
    </button>
  ),
  Logo: ({ size }: { size: number }) => (
    <span data-testid="selected-logo" data-size={size}>
      Selected icon
    </span>
  ),
}));

function fixture(selected = false, editable = true) {
  const page = {
    isContentEditable: editable,
    logo_props: selected ? { in_use: "icon", icon: { name: "Star" } } : {},
    updatePageLogo: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue({}),
  };
  return page;
}

it("selects an icon through the existing page logo action", async () => {
  const page = fixture();
  render(<PageEditorHeaderLogoPicker page={page as unknown as TPageInstance} />);
  fireEvent.click(screen.getByRole("button", { name: "web.icon" }));
  await waitFor(() =>
    expect(page.updatePageLogo).toHaveBeenCalledWith({ type: "icon", value: { name: "Star", color: "#ff0000" } })
  );
});

it("keeps the chosen logo compact and allows replacement", async () => {
  const page = fixture(true);
  render(<PageEditorHeaderLogoPicker page={page as unknown as TPageInstance} />);
  expect(screen.getByTestId("selected-logo").getAttribute("data-size")).toBe("16");
  const clear = screen.getByRole("button", { name: "common.clear" });
  expect(clear.parentElement?.className).toContain("h-6 bg-layer-1");
  expect(clear.parentElement?.className).toContain("rounded-md");
  expect(clear.parentElement?.className).not.toContain("border");
  expect(clear.className).toContain("px-2 py-0");
  fireEvent.click(screen.getByRole("button", { name: "Selected icon" }));
  await waitFor(() => expect(page.updatePageLogo).toHaveBeenCalled());
});

it("persists an empty object when clearing and restores the icon label on rerender", async () => {
  const page = fixture(true);
  const { rerender } = render(<PageEditorHeaderLogoPicker page={page as unknown as TPageInstance} />);
  fireEvent.click(screen.getByRole("button", { name: "common.clear" }));
  await waitFor(() => expect(page.update).toHaveBeenCalledWith({ logo_props: {} }));
  page.logo_props = {} as typeof page.logo_props;
  rerender(<PageEditorHeaderLogoPicker page={page as unknown as TPageInstance} />);
  expect(screen.getByRole("button", { name: "web.icon" })).toBeTruthy();
  expect(screen.queryByTestId("selected-logo")).toBeNull();
});

it("disables both actions while clearing is pending and preserves the icon on failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const page = fixture(true);
  let rejectSave: (error: Error) => void = () => undefined;
  page.update.mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      })
  );
  render(<PageEditorHeaderLogoPicker page={page as unknown as TPageInstance} />);
  fireEvent.click(screen.getByRole("button", { name: "common.clear" }));
  expect(screen.getByRole("button", { name: "common.clear" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Selected icon" }).hasAttribute("disabled")).toBe(true);
  rejectSave(new Error("Failed"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "common.clear" }).hasAttribute("disabled")).toBe(false)
  );
  expect(screen.getByTestId("selected-logo")).toBeTruthy();
  vi.restoreAllMocks();
});

it("prevents choosing or clearing icons for read-only content", () => {
  const page = fixture(true, false);
  render(<PageEditorHeaderLogoPicker page={page as unknown as TPageInstance} />);
  const button = screen.getByRole("button", { name: "Selected icon" });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.click(button);
  expect(page.updatePageLogo).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "common.clear" })).toBeNull();
});
