import { useSyncExternalStore } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createPlateEditor } from "platejs/react";
import { createPlateRef } from "./ref";
import type { EditorAssets } from "./assets";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

function documentWithHeading() {
  const editor = createPlateEditor({
    value: [
      { type: "h1", children: [{ text: "Docker images" }] },
      { type: "p", children: [{ text: "Description" }] },
    ],
  });
  const ref = createPlateRef(editor, {} as EditorAssets, vi.fn(), () => null);
  return { editor, ...ref };
}

it("returns a stable heading snapshot until the outline changes", () => {
  const { editor, api } = documentWithHeading();
  const initial = api.getHeadings();
  expect(initial).toEqual([{ type: "heading", level: 1, text: "Docker images", sequence: 0 }]);
  expect(api.getHeadings()).toBe(initial);
  editor.tf.insertText(" updated", { at: { path: [1, 0], offset: 11 } });
  expect(api.getHeadings()).toBe(initial);
  editor.tf.insertText("Updated ", { at: { path: [0, 0], offset: 0 } });
  const renamed = api.getHeadings();
  expect(renamed).not.toBe(initial);
  expect(renamed[0].text).toBe("Updated Docker images");
  expect(api.getHeadings()).toBe(renamed);
  editor.tf.setNodes({ type: "h2" }, { at: [0] });
  expect(api.getHeadings()[0].level).toBe(2);
  editor.tf.insertNodes({ type: "p", children: [{ text: "Before heading" }] }, { at: [0] });
  expect(api.getHeadings()[0].sequence).toBe(1);
  editor.tf.removeNodes({ at: [1] });
  const empty = api.getHeadings();
  expect(empty).toEqual([]);
  expect(api.getHeadings()).toBe(empty);
});

it("renders and updates a heading subscriber without a React update loop", () => {
  const { editor, api, notify } = documentWithHeading();
  const subscribe = (onChange: () => void) => api.onHeadingChange(onChange);
  function Outline() {
    const headings = useSyncExternalStore(subscribe, api.getHeadings);
    return (
      <nav>
        {headings.map((heading) => (
          <button key={heading.sequence}>{heading.text}</button>
        ))}
      </nav>
    );
  }
  render(<Outline />);
  expect(screen.getByRole("button").textContent).toBe("Docker images");
  act(() => {
    editor.tf.insertText("Updated ", { at: { path: [0, 0], offset: 0 } });
    notify();
  });
  expect(screen.getByRole("button").textContent).toBe("Updated Docker images");
  act(() => {
    editor.tf.removeNodes({ at: [0] });
    notify();
  });
  expect(screen.queryByRole("button")).toBeNull();
});
