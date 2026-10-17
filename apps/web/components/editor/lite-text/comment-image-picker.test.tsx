import { afterEach, expect, it, vi } from "vitest";
import type { EditorRefApi } from "@plane/editor";
import { pickCommentImage } from "./comment-image-picker";

afterEach(() => {
  document.querySelectorAll('input[type="file"]').forEach((input) => input.remove());
  vi.restoreAllMocks();
});

function fixture() {
  const executeMenuItemCommand = vi.fn();
  const editor = { getCurrentCursorPosition: () => 7, executeMenuItemCommand } as unknown as EditorRefApi;
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
  pickCommentImage(editor);
  return { executeMenuItemCommand, input: document.querySelector('input[type="file"]') as HTMLInputElement };
}

it("does not change the document when the image picker opens or is canceled", () => {
  const { input, executeMenuItemCommand } = fixture();
  expect(executeMenuItemCommand).not.toHaveBeenCalled();
  input.dispatchEvent(new Event("cancel"));
  expect(executeMenuItemCommand).not.toHaveBeenCalled();
  expect(document.body.contains(input)).toBe(false);
});

it("inserts only the chosen image at the saved cursor and removes its input", () => {
  const { input, executeMenuItemCommand } = fixture();
  const file = new File(["image"], "sample.png", { type: "image/png" });
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new Event("change"));
  expect(executeMenuItemCommand).toHaveBeenCalledExactlyOnceWith({
    itemKey: "image",
    savedSelection: null,
    file,
    pos: 7,
  });
  expect(document.body.contains(input)).toBe(false);
});
