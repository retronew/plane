import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CategoryColorPicker } from "./category-color-picker";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
function Editor() {
  const [value, setValue] = useState("#60646c");
  return <CategoryColorPicker value={value} onChange={setValue} />;
}
it("opens the shared palette and keeps color edits in the controlled field", async () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.color_picker.open" }));
  const swatch = await screen.findByRole("button", { name: "#0693e3" });
  fireEvent.click(swatch);
  expect(swatch.getAttribute("aria-pressed")).toBe("true");
  const hex = screen.getByRole("textbox", { name: "aria_labels.color_picker.hex_input" });
  fireEvent.change(hex, { target: { value: "123abc" } });
  await waitFor(() => expect(swatch.getAttribute("aria-pressed")).toBe("false"));
  expect(screen.getByRole("dialog")).toBeTruthy();
});
it("cannot open while the form is saving", () => {
  render(<CategoryColorPicker value="#60646c" onChange={vi.fn()} disabled />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
});
