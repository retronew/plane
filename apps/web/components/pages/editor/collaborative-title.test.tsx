import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { CollaborativePageTitle, updateCollaborativeTitle } from "./collaborative-title";

vi.mock("@/hooks/use-page-filters", () => ({ usePageFilters: () => ({ fontSize: "small-font" }) }));

afterEach(() => vi.unstubAllGlobals());

it("preserves the unframed document title and remains read-only until collaboration is ready", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  render(<CollaborativePageTitle provider={null} editable initialValue="Document" onTitleChange={vi.fn()} />);
  const title = screen.getByRole("textbox") as HTMLTextAreaElement;
  expect(title.tagName).toBe("TEXTAREA");
  expect(title.className).toContain("border-none");
  expect(title.className).toContain("text-[1.6rem]");
  expect(title.placeholder).toBe("Untitled");
  expect(title.readOnly).toBe(true);
  expect(title.value).toBe("Document");
});

it("replaces only the changed title span and preserves concurrent edits", () => {
  const left = new Y.Doc();
  const right = new Y.Doc();
  left.getText("title").insert(0, "Original title");
  Y.applyUpdate(right, Y.encodeStateAsUpdate(left));
  updateCollaborativeTitle(left.getText("title"), "New title");
  right.getText("title").insert(right.getText("title").length, " suffix");
  Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
  Y.applyUpdate(right, Y.encodeStateAsUpdate(left));
  expect(left.getText("title").toString()).toBe("New title suffix");
  expect(right.getText("title").toString()).toBe("New title suffix");
  left.destroy();
  right.destroy();
});

it("handles empty and unchanged titles without inserting HTML", () => {
  const doc = new Y.Doc();
  const text = doc.getText("title");
  updateCollaborativeTitle(text, "Title <template>");
  updateCollaborativeTitle(text, "Title <template>");
  expect(text.toString()).toBe("Title <template>");
  updateCollaborativeTitle(text, "");
  expect(text.toString()).toBe("");
  doc.destroy();
});
