import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import { comparisonPlugins } from "./plate-kit";
import { FontColorToolbarButton } from "./font-color-toolbar-button";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
it("preserves the selection for color input and clears only the requested mark", async () => {
  const editor = createPlateEditor({
    plugins: comparisonPlugins,
    value: [{ type: "p", children: [{ text: "Color", backgroundColor: "#ffff00" }] }],
  });
  render(
    <Plate editor={editor}>
      <PlateContent />
      <FontColorToolbarButton mark="color" label="Text color" clearLabel="Clear color" />
    </Plate>
  );
  act(() => editor.tf.select({ anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } }));
  fireEvent.click(screen.getByRole("button", { name: "Text color" }));
  const input = await screen.findByLabelText("editor_comparison.customColor", { selector: "input" });
  act(() => editor.tf.deselect());
  fireEvent.change(input, { target: { value: "#123456" } });
  expect(editor.children[0].children[0]).toMatchObject({ color: "#123456", backgroundColor: "#ffff00" });
  fireEvent.click(screen.getByRole("button", { name: "Clear color" }));
  expect(editor.children[0].children[0]).not.toHaveProperty("color");
  expect(editor.children[0].children[0]).toHaveProperty("backgroundColor", "#ffff00");
});
