import { createRef, StrictMode, useCallback, useState } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlateEditorWithRef } from "./editor";
import type { EditorRefApi, TFileHandler } from "../types";
import type { PlateEditorProps } from "./types";
import { shouldSubmitComment } from "./keyboard";
import { comparisonCommandLabels } from "./plate-kit";
import { createEditorAssets, useEditorAssets } from "./assets";
import { htmlToSlate, slateToHtml } from "../plate-headless";
import { legacyJSONToSlate, slateToLegacyJSON } from "./legacy-json";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const fileHandler: TFileHandler = {
  assetsUploadStatus: {},
  cancel: vi.fn(),
  checkIfAssetExists: async () => true,
  delete: vi.fn(),
  restore: vi.fn(),
  getAssetSrc: async (id) => `https://assets.example/${id}`,
  getAssetDownloadSrc: async (id) => id,
  upload: async () => "asset-one",
  duplicate: async () => "asset-copy",
  validation: { maxFileSize: 1000 },
};
const props: PlateEditorProps = {
  id: "production-test",
  initialValue: "<p>Initial</p>",
  editable: true,
  disabledExtensions: [],
  flaggedExtensions: [],
  fileHandler,
  mentionHandler: { renderComponent: ({ entity_identifier }) => <span>{entity_identifier}</span> },
  getEditorMetaData: () => ({ file_assets: [], user_mentions: [] }),
  extendedEditorProps: {},
};
afterEach(cleanup);
it("renders one row control per row and one column control per column for imported cells without IDs", () => {
  const view = render(
    <PlateEditorWithRef
      {...props}
      initialValue="<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>"
    />
  );
  expect(view.container.querySelectorAll(".comparison-table-more-row")).toHaveLength(2);
  expect(view.container.querySelectorAll(".comparison-table-more-column")).toHaveLength(2);
  const rows = view.container.querySelectorAll("tr");
  for (const row of rows) expect(row.querySelectorAll(".comparison-table-more-row")).toHaveLength(1);
});
it("includes labels for every basic block and inline format used by the toolbar", () => {
  for (const key of [
    "paragraph",
    "heading1",
    "heading2",
    "blockquote",
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "code",
  ] as const) {
    expect(comparisonCommandLabels[key]).toBeTruthy();
  }
});
it("focuses the document end when its lower editable whitespace is clicked", async () => {
  const ref = createRef<EditorRefApi>();
  const view = render(<PlateEditorWithRef {...props} mode="document" ref={ref} tabIndex={0} />);
  const content = view.container.querySelector('[contenteditable="true"]') as HTMLElement;
  expect(content.className).toContain("min-h-dvh");
  fireEvent.mouseDown(content, { clientY: 600 });
  await act(async () => {
    ref.current!.insertText("<span> end</span>");
  });
  expect(ref.current!.getDocument().html).toContain("Initial end");
  await waitFor(() => expect(document.activeElement).toBe(content));
});
it("focuses the description end from its lower whitespace without enlarging comments", async () => {
  const ref = createRef<EditorRefApi>();
  const view = render(<PlateEditorWithRef {...props} mode="rich" ref={ref} />);
  const content = view.container.querySelector('[contenteditable="true"]') as HTMLElement;
  expect(content.className).toContain("min-h-32");
  fireEvent.mouseDown(content, { clientY: 100, button: 0 });
  await act(async () => {
    ref.current!.insertText("<span> end</span>");
  });
  expect(ref.current!.getDocument().html).toContain("Initial end");
  await waitFor(() => expect(document.activeElement).toBe(content));
  view.unmount();
  const comment = render(<PlateEditorWithRef {...props} mode="lite" />);
  expect(comment.container.querySelector('[contenteditable="true"]')?.className).toContain("min-h-12");
});
it("keeps the imperative API stable when a wrapper stores it and recreates file handlers", () => {
  const published = vi.fn();
  function Wrapper({ revision }: { revision: number }) {
    const [api, setEditorApi] = useState<EditorRefApi | null>(null);
    const setEditorRef = useCallback((instance: EditorRefApi | null) => {
      published(instance);
      setEditorApi(instance);
    }, []);
    return (
      <>
        <span data-testid="wrapper-api">{api ? revision : "pending"}</span>
        <PlateEditorWithRef {...props} fileHandler={{ ...fileHandler }} ref={setEditorRef} />
      </>
    );
  }
  const view = render(<Wrapper revision={0} />);
  const api = published.mock.calls[0][0];
  expect(screen.getByTestId("wrapper-api").textContent).toBe("0");
  view.rerender(<Wrapper revision={1} />);
  expect(screen.getByTestId("wrapper-api").textContent).toBe("1");
  expect(published).toHaveBeenCalledExactlyOnceWith(api);
});
it("keeps assets stable while reading the latest handlers, validation and upload status", async () => {
  const hook = renderHook(({ handler }) => useEditorAssets(handler), { initialProps: { handler: fileHandler } });
  const assets = hook.result.current;
  const latest = {
    ...fileHandler,
    getAssetSrc: vi.fn(async (id: string) => `https://latest.example/${id}`),
    upload: vi.fn(async () => "latest-image"),
    delete: vi.fn(async () => {}),
    assetsUploadStatus: { block: 50 },
    validation: { maxFileSize: 0 },
  };
  hook.rerender({ handler: latest });
  expect(hook.result.current).toBe(assets);
  expect(assets.fileHandler).toBe(latest);
  expect(assets.fileHandler.assetsUploadStatus.block).toBe(50);
  await assets.fileHandler.delete("old-image");
  expect(latest.delete).toHaveBeenCalledWith("old-image");
  const image = new File(["x"], "photo.png", { type: "image/png" });
  await expect(assets.upload("block", image)).rejects.toThrow("Invalid image upload");
  hook.rerender({ handler: { ...latest, validation: { maxFileSize: 1000 } } });
  await expect(assets.upload("block", image)).resolves.toBe("latest-image");
  expect(latest.upload).toHaveBeenCalledWith("block", image);
  expect(assets.get("latest-image")).toBe("https://latest.example/latest-image");
});
it("isolates mounted entities and survives StrictMode cleanup replay", async () => {
  vi.useFakeTimers();
  try {
    const first = renderHook(() => useEditorAssets(fileHandler), { wrapper: StrictMode });
    const second = renderHook(() =>
      useEditorAssets({
        ...fileHandler,
        getAssetSrc: async (id) => `https://second.example/${id}`,
      })
    );
    await act(async () => vi.runAllTimers());
    await first.result.current.load("same-id");
    await second.result.current.load("same-id");
    const assets = first.result.current;
    expect(assets.get("same-id")).toBe("https://assets.example/same-id");
    expect(second.result.current.get("same-id")).toBe("https://second.example/same-id");
    let finish: (url: string) => void = () => {};
    assets.setFileHandler({
      ...fileHandler,
      getAssetSrc: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const pending = assets.load("late-image");
    const listener = vi.fn();
    assets.subscribe(listener);
    first.unmount();
    await act(async () => vi.runAllTimers());
    finish("https://assets.example/late-image");
    await pending;
    expect(assets.get("same-id")).toBeUndefined();
    expect(assets.get("late-image")).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
    expect(second.result.current.get("same-id")).toBe("https://second.example/same-id");
    second.unmount();
    await act(async () => vi.runAllTimers());
  } finally {
    vi.useRealTimers();
  }
});
it("exports synchronous current HTML, silently clears, then emits the next real change", async () => {
  const ref = createRef<EditorRefApi>();
  const onChange = vi.fn();
  render(<PlateEditorWithRef {...props} ref={ref} onChange={onChange} />);
  expect(ref.current!.getDocument().html).toContain("Initial");
  expect(screen.queryByRole("button", { name: "editor_comparison.bold" })).toBeNull();
  await act(async () => ref.current!.setEditorValue("<h2>Updated</h2>", true));
  expect(ref.current!.getDocument().html).toContain("Updated");
  expect(onChange).toHaveBeenCalled();
  onChange.mockClear();
  await act(async () => ref.current!.clearEditor());
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => ref.current!.setEditorValue("<p>Next</p>", true));
  expect(onChange).toHaveBeenCalled();
  expect(fileHandler.delete).not.toHaveBeenCalled();
});
it("renders readonly content and reacts to external value changes", async () => {
  const view = render(<PlateEditorWithRef {...props} editable={false} value="<p>Readonly</p>" />);
  expect(view.container.querySelector("[data-slate-editor]")?.getAttribute("contenteditable")).toBe("false");
  await act(async () => view.rerender(<PlateEditorWithRef {...props} editable={false} value="<p>New version</p>" />));
  expect(screen.getByText("New version")).toBeTruthy();
});
it("uses the actual mention renderer and preserves opaque legacy content", () => {
  render(
    <PlateEditorWithRef
      {...props}
      initialValue='<p><mention-component id="Member" entity_identifier="real-member" entity_name="user_mention"></mention-component></p><section data-custom="legacy">Preserved legacy</section>'
    />
  );
  expect(screen.getByText("real-member")).toBeTruthy();
  expect(screen.getByText("Preserved legacy")).toBeTruthy();
});
it("submits comments with Enter while respecting composition and Shift", () => {
  const submit = vi.fn();
  render(<PlateEditorWithRef {...props} mode="lite" onEnterKeyPress={submit} />);
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(submit).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true });
  expect(submit).toHaveBeenCalledOnce();
  expect(
    shouldSubmitComment(
      { key: "Enter", shiftKey: false, altKey: false, ctrlKey: true, metaKey: false, isComposing: true },
      "mod-enter",
      false
    )
  ).toBe(false);
});
it("resolves real assets asynchronously and reports in-flight uploads", async () => {
  let finish: (value: string) => void = () => {};
  const asset = createEditorAssets({
    ...fileHandler,
    upload: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const pending = asset.upload("block", new File(["x"], "photo.png", { type: "image/png" }));
  expect(asset.isUploading()).toBe(true);
  finish("uploaded");
  expect(await pending).toBe("uploaded");
  expect(asset.get("uploaded")).toBe("https://assets.example/uploaded");
  expect(asset.isUploading()).toBe(false);
  await expect(asset.upload("block", new File(["x"], "x.txt", { type: "text/plain" }))).rejects.toThrow();
});
it("round trips legacy document headings and marks without pretending Slate is PM JSON", () => {
  const nodes = htmlToSlate("<h2>Title</h2><p><strong>Bold</strong></p>");
  const json = slateToLegacyJSON(nodes);
  expect(json.type).toBe("doc");
  expect(json.content?.[0].type).toBe("heading");
  expect(slateToHtml(legacyJSONToSlate(json))).toContain("<strong>Bold</strong>");
});

it("opens the image picker without a file and uploads through the real handler", async () => {
  const ref = createRef<EditorRefApi>();
  const upload = vi.fn(async () => "picked-image");
  render(<PlateEditorWithRef {...props} ref={ref} fileHandler={{ ...fileHandler, upload }} />);
  let input: HTMLInputElement | undefined;
  const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    // oxlint-disable-next-line typescript/no-this-alias -- Capture the native picker receiver for its change event.
    input = this;
  });
  try {
    act(() => ref.current!.executeMenuItemCommand({ itemKey: "image", savedSelection: null }));
    expect(input?.accept).toBe("image/*");
    Object.defineProperty(input!, "files", { value: [new File(["x"], "photo.png", { type: "image/png" })] });
    await act(async () => input!.dispatchEvent(new Event("change")));
    expect(upload).toHaveBeenCalled();
    expect(ref.current!.getDocument().html).toContain("picked-image");
  } finally {
    click.mockRestore();
  }
});
it("preserves legacy list indentation during document version import", () => {
  const value = legacyJSONToSlate({
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "First" }] },
              {
                type: "orderedList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested" }] }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  expect(value.map((node) => node.indent)).toEqual([1, 2]);
  expect(slateToHtml(value)).toContain("Nested");
});

it("respects disabled formatting controls and rejects disabled imperative uploads", () => {
  const ref = createRef<EditorRefApi>();
  render(<PlateEditorWithRef {...props} ref={ref} toolbar="fixed" disabledExtensions={["image"]} />);
  expect(() => ref.current!.executeMenuItemCommand({ itemKey: "image", savedSelection: null })).toThrow("disabled");
});
