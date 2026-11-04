import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from "@platejs/code-block/react";
import { common, createLowlight } from "lowlight";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import { ComparisonCodeBlock } from "./code-block";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(readOnly = false) {
  const editor = createPlateEditor({
    plugins: [
      CodeBlockPlugin.configure({ options: { lowlight: createLowlight(common) } }).withComponent(ComparisonCodeBlock),
      CodeLinePlugin,
      CodeSyntaxPlugin,
    ],
    value: [
      {
        type: "code_block",
        lang: "javascript",
        children: [
          { type: "code_line", children: [{ text: "const value = 1;" }] },
          { type: "code_line", children: [{ text: "" }] },
          { type: "code_line", children: [{ text: "  value;" }] },
          { type: "code_line", children: [{ text: "" }] },
        ],
      },
      { type: "p", children: [{ text: "Following paragraph" }] },
    ],
  });
  const view = render(
    <Plate editor={editor} readOnly={readOnly}>
      <PlateContent />
    </Plate>
  );
  return { editor, ...view };
}

it("copies code lines preserving blank lines, indentation and a trailing newline", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "web.copy_code" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("const value = 1;\n\n  value;\n"));
  expect(screen.getByRole("status").textContent).toBe("web.copied");
});

it("selects a language from the configured lowlight languages", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const { editor } = mount();
  fireEvent.click(screen.getByRole("combobox", { name: "language" }));
  const option = await screen.findByRole("option", { name: "python" });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(editor.children[0].lang).toBe("python"));
  expect(editor.children[0].children).toHaveLength(4);
});

it("deletes only the target code block", () => {
  const { editor } = mount();
  fireEvent.click(screen.getByRole("button", { name: "delete" }));
  expect(editor.children).toEqual([{ type: "p", children: [{ text: "Following paragraph" }] }]);
});

it("keeps copying available in read-only mode without mutation controls", () => {
  mount(true);
  expect(screen.getByRole("button", { name: "web.copy_code" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByText("javascript")).toBeTruthy();
});

it("reports clipboard failures without claiming success", async () => {
  vi.stubGlobal("navigator", {
    ...navigator,
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mount(true);
  fireEvent.click(screen.getByRole("button", { name: "web.copy_code" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("web.page_copy_failed"));
});
