import { describe, expect, it } from "vitest";
import { createSlateEditor } from "platejs";
import { comparisonBasePlugins, deserializeComparisonHtml, serializeComparisonHtml } from "./plate-kit";
import { COMPARISON_IMAGE, COMPARISON_SAMPLE, FULL_COMPARISON_SAMPLE } from "./sample";
import { createSandboxAssets } from "./sandbox-assets";

describe("comparison image samples", () => {
  it.each([
    ["default", COMPARISON_SAMPLE],
    ["full", FULL_COMPARISON_SAMPLE],
  ])("includes a resolvable, editable image in the %s sample and retains it after reimport", async (_name, sample) => {
    const assets = createSandboxAssets();
    const editor = createSlateEditor({ plugins: comparisonBasePlugins });
    const value = deserializeComparisonHtml(editor, sample);
    const image = value.find((node) => node.type === "sandboxImage");
    expect(image).toMatchObject({ src: COMPARISON_IMAGE.id, width: "100%", alignment: "center" });
    expect(assets.get(String(image?.src))).toBe(COMPARISON_IMAGE.url);
    editor.tf.setValue(value);
    const index = editor.children.findIndex((node) => node.type === "sandboxImage");
    editor.tf.setNodes({ width: "240px", alignment: "right", alt: "Edited image" }, { at: [index] });
    const html = await serializeComparisonHtml(editor.children);
    const element = new DOMParser().parseFromString(html, "text/html").querySelector("image-component");
    expect(element?.getAttribute("src")).toBe(COMPARISON_IMAGE.id);
    expect(element?.getAttribute("status")).toBe("uploaded");
    expect(element?.getAttribute("width")).toBe("240px");
    expect(element?.getAttribute("alignment")).toBe("right");
    expect(element?.getAttribute("alt")).toBe("Edited image");
    expect(html).not.toContain("blob:");
    expect(deserializeComparisonHtml(editor, html).find((node) => node.type === "sandboxImage")).toMatchObject({
      src: COMPARISON_IMAGE.id,
      width: "240px",
      alignment: "right",
      alt: "Edited image",
    });
    await assets.fileHandler.delete(COMPARISON_IMAGE.id);
    editor.tf.setValue(deserializeComparisonHtml(editor, sample));
    expect(editor.children.find((node) => node.type === "sandboxImage")).toMatchObject({
      src: COMPARISON_IMAGE.id,
      width: "100%",
      alignment: "center",
    });
    expect(await assets.fileHandler.getAssetSrc(COMPARISON_IMAGE.id)).toBe(COMPARISON_IMAGE.url);
    assets.dispose();
  });
});
