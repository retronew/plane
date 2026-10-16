import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { IconColorPanel } from "./color-panel";
function Fixture() {
  const [color, setColor] = useState("#5e6ad2");
  return (
    <>
      <IconColorPanel color={color} onChange={setColor} />
      <output data-testid="selected">{color}</output>
    </>
  );
}
it("switches preset and continuous modes without losing the selected color", () => {
  render(<Fixture />);
  expect(screen.queryByRole("slider")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "#eb5757" }));
  fireEvent.click(screen.getByRole("button", { name: "Set custom color" }));
  expect(screen.getAllByRole("slider")).toHaveLength(2);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "#123456" } });
  expect(screen.getByTestId("selected").textContent).toBe("#123456");
  fireEvent.change(screen.getByRole("slider", { name: "Hue" }), { target: { value: "120" } });
  expect(screen.getByTestId("selected").textContent).toBe("#125612");
  fireEvent.click(screen.getByRole("button", { name: "Select preset color" }));
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.getByTestId("selected").textContent).toBe("#125612");
});
