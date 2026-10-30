import { afterEach, describe, expect, it, vi } from "vitest";
import { createSlateEditor, ElementApi } from "platejs";
import { serializeHtml } from "platejs/static";
import { BaseSandboxImagePlugin, insertSandboxImage, SandboxImageStaticElement } from "./image-plugin";
import { createSandboxAssets } from "./sandbox-assets";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createPlateEditor, EventEditorStore, Plate, PlateContent } from "platejs/react";
import { SandboxAssetsProvider, SandboxImagePlugin } from "./image-plugin";
import { COMPARISON_IMAGE } from "./sample";

const createEditor = () =>
  createSlateEditor({
    plugins: [BaseSandboxImagePlugin],
    override: { components: { [BaseSandboxImagePlugin.key]: SandboxImageStaticElement } },
  });

describe("sandbox image interaction", () => {
  it("selects without navigation, exposes editing and separate preview, and restores deleted assets on undo", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const assets = createSandboxAssets();
    const editor = createPlateEditor({
      plugins: [SandboxImagePlugin],
      value: [
        { type: "sandboxImage", src: COMPARISON_IMAGE.id, alt: "Landscape", width: "50%", children: [{ text: "" }] },
        { type: "p", children: [{ text: "After" }] },
      ],
    });
    render(
      <SandboxAssetsProvider assets={assets}>
        <Plate editor={editor}>
          <PlateContent />
        </Plate>
      </SandboxAssetsProvider>
    );
    const image = screen.getByAltText("Landscape");
    expect(image.closest("a")).toBeNull();
    expect(screen.queryByLabelText("Image width")).toBeNull();
    await act(async () => {
      EventEditorStore.set("last", editor.id);
      fireEvent.mouseDown(image);
      fireEvent.click(image);
    });
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Image width")).toBeTruthy();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Image width"), { target: { value: "240" } });
      fireEvent.blur(screen.getByLabelText("Image width"));
    });
    expect(editor.children[0].width).toBe("240px");
    fireEvent.click(screen.getByLabelText("Preview image"));
    expect(await screen.findByRole("dialog", { name: "Preview image" })).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Close preview"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Alternative text"), { target: { value: "Updated" } });
    });
    expect(editor.children[0].alt).toBe("Updated");
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Delete image"));
    });
    await waitFor(() => expect(screen.queryByAltText("Updated")).toBeNull());
    await act(async () => {
      editor.tf.undo();
    });
    expect(screen.getByAltText("Updated").getAttribute("src")).toBe(COMPARISON_IMAGE.url);
    await act(async () => {
      editor.tf.select({ path: [1, 0], offset: 0 });
    });
    expect(screen.queryByLabelText("Image width")).toBeNull();
    open.mockRestore();
  });
});

describe("sandbox image HTML", () => {
  it("serializes official numeric resize widths as pixels and preserves undo", async () => {
    const editor = createEditor();
    editor.tf.setValue([
      {
        type: "sandboxImage",
        src: "asset-id",
        width: "50%",
        height: "120px",
        alignment: "right",
        children: [{ text: "" }],
      },
    ]);
    editor.tf.withNewBatch(() => editor.tf.setNodes({ width: 320 }, { at: [0] }));
    const html = await serializeHtml(editor);
    const image = new DOMParser().parseFromString(html, "text/html").querySelector("image-component");
    expect(image?.getAttribute("width")).toBe("320px");
    expect(image?.getAttribute("height")).toBe("auto");
    expect(image?.getAttribute("src")).toBe("asset-id");
    expect(image?.getAttribute("alignment")).toBe("right");
    editor.tf.undo();
    expect(editor.children[0].width).toBe("50%");
  });
  afterEach(() => vi.unstubAllGlobals());
  it("round trips legacy asset IDs, dimensions, alignment, and alt without object URLs", async () => {
    const editor = createEditor();
    const id = crypto.randomUUID();
    const value = editor.api.html.deserialize({
      element: `<image-component src="${id}" width="240px" height="120px" alignment="right" alt="A &amp; B" aspectratio="2"></image-component>`,
    });
    expect(value[0]).toMatchObject({
      type: BaseSandboxImagePlugin.key,
      src: id,
      width: "240px",
      height: "120px",
      alignment: "right",
      alt: "A & B",
      aspectRatio: "2",
    });
    editor.children = value.filter(ElementApi.isElement);
    const html = await serializeHtml(editor);
    const element = new DOMParser().parseFromString(html, "text/html").querySelector("image-component");
    expect(element?.getAttribute("src")).toBe(id);
    expect(element?.getAttribute("alt")).toBe("A & B");
    expect(editor.api.html.deserialize({ element: html })[0]).toMatchObject(value[0]);
    expect(html).not.toContain("blob:");
  });

  it("uploads and inserts an image that participates in undo and redo", async () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    const editor = createEditor();
    const assets = createSandboxAssets();
    await insertSandboxImage(editor, assets, new File(["image"], "test.png", { type: "image/png" }));
    const image = editor.children.find((node) => node.type === BaseSandboxImagePlugin.key);
    expect(image).toMatchObject({ alt: "test.png", width: "35%" });
    expect(assets.get(String(image?.src))).toBe("blob:test");
    editor.tf.undo();
    expect(editor.children.some((node) => node.type === BaseSandboxImagePlugin.key)).toBe(false);
    editor.tf.redo();
    expect(editor.children.some((node) => node.type === BaseSandboxImagePlugin.key)).toBe(true);
    assets.dispose();
  });
});
