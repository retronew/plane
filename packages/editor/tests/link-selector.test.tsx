import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, expect, it, vi } from "vitest";
import { BubbleMenuLinkSelector } from "../src/components/menus/bubble-menu/link-selector";

afterEach(cleanup);
function setup(href = "") {
  const setLink = vi.fn();
  const chain = {
    focus: () => chain,
    setLink: (value: unknown) => {
      setLink(value);
      return chain;
    },
    run: () => true,
  };
  const editor = {
    isActive: () => false,
    getAttributes: () => ({ href }),
    state: { selection: { from: 1, to: 5 } },
    chain: () => chain,
  } as unknown as Editor;
  render(<BubbleMenuLinkSelector editor={editor} />);
  fireEvent.click(screen.getByRole("button"));
  const input = screen.getByRole("textbox") as HTMLInputElement;
  return { input, setLink };
}
it("initializes and focuses the URL only after the user opens the menu", () => {
  const { input } = setup("https://existing.example");
  expect(input.value).toBe("https://existing.example");
  expect(document.activeElement).toBe(input);
});
it("does not submit an IME confirmation Enter", () => {
  const { input, setLink } = setup();
  fireEvent.change(input, { target: { value: "https://new.example" } });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(setLink).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).not.toBeNull();
});
it("does not submit the legacy IME keyCode 229 confirmation", () => {
  const { input, setLink } = setup();
  fireEvent.change(input, { target: { value: "https://new.example" } });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
  expect(setLink).not.toHaveBeenCalled();
});
it("does not apply an unfinished draft on blur and initializes a fresh session on reopen", () => {
  const { input, setLink } = setup("https://existing.example");
  fireEvent.change(input, { target: { value: "https://draft.example" } });
  fireEvent.blur(input);
  expect(setLink).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.click(screen.getByRole("button"));
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("https://existing.example");
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
});
it("submits ordinary Enter and closes the session", () => {
  const { input, setLink } = setup();
  fireEvent.change(input, { target: { value: "https://new.example" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(setLink).toHaveBeenCalledWith({ href: "https://new.example" });
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("dismisses Escape without applying the URL", () => {
  const { input, setLink } = setup();
  fireEvent.change(input, { target: { value: "https://new.example" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(setLink).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).toBeNull();
});
