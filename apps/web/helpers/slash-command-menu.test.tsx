import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
// Load source at runtime: the editor has its own @/* TypeScript aliases.
const editorMenuPath = path.resolve(
  import.meta.dirname,
  "../../../packages/editor/src/extensions/slash-commands/command-menu.tsx"
);
const { SlashCommandsMenu } = await import(editorMenuPath);

vi.mock("@floating-ui/react", () => ({ FloatingOverlay: () => null }));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function menuProps(query = "") {
  return {
    query,
    command: vi.fn(),
    onClose: vi.fn(),
    items: [
      {
        key: "basic",
        items: [
          { key: "text", commandKey: "text", title: "Text", icon: null },
          { key: "heading", commandKey: "heading", title: "Heading", icon: null },
        ],
      },
    ],
  };
}

describe("slash command selection", () => {
  it("retains keyboard selection when equivalent results are recreated", () => {
    const props = menuProps();
    const { rerender } = render(<SlashCommandsMenu {...props} />);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Heading" }).hasAttribute("data-selected")).toBe(true);
    rerender(<SlashCommandsMenu {...props} items={menuProps().items} />);
    expect(screen.getByRole("button", { name: "Heading" }).hasAttribute("data-selected")).toBe(true);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(props.command).toHaveBeenCalledWith(expect.objectContaining({ key: "heading" }));
  });

  it("resets selection when the query changes", () => {
    const { rerender } = render(<SlashCommandsMenu {...menuProps()} />);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    rerender(<SlashCommandsMenu {...menuProps("text")} />);
    expect(screen.getByRole("button", { name: "Text" }).hasAttribute("data-selected")).toBe(true);
  });
});
