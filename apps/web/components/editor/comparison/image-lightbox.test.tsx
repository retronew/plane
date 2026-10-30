import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import { collectDocumentImages } from "./image-lightbox";
import { SandboxAssetsProvider, SandboxImagePlugin } from "./image-plugin";
import { createSandboxAssets } from "./sandbox-assets";
import { COMPARISON_IMAGE } from "./sample";

const image = (alt: string) => ({ type: "sandboxImage", src: COMPARISON_IMAGE.id, alt, children: [{ text: "" }] });

describe("document image lightbox", () => {
  it("collects nested images in document order, skips unavailable assets, and preserves duplicate sources", () => {
    const images = collectDocumentImages(
      [
        image("First"),
        { type: "blockquote", children: [image("Nested"), { ...image("Missing"), src: "missing" }] },
        image("Last"),
      ],
      createSandboxAssets()
    );
    expect(images.map(({ alt, path }) => [alt, path])).toEqual([
      ["First", "0"],
      ["Nested", "1.0"],
      ["Last", "2"],
    ]);
    expect(images.every(({ src }) => src === COMPARISON_IMAGE.url)).toBe(true);
  });

  it("opens the double-clicked image, cycles with buttons and arrows, closes with Escape and restores focus", async () => {
    const editor = createPlateEditor({
      plugins: [SandboxImagePlugin],
      value: [image("First"), image("Second"), image("Third")],
    });
    render(
      <SandboxAssetsProvider assets={createSandboxAssets()}>
        <Plate editor={editor}>
          <PlateContent />
        </Plate>
      </SandboxAssetsProvider>
    );
    const trigger = screen.getByAltText("Second").closest("button");
    await act(async () => {
      fireEvent.doubleClick(screen.getByAltText("Second"));
    });
    const dialog = await screen.findByRole("dialog", { name: "Preview image" });
    expect(within(dialog).getByAltText("Second")).toBeTruthy();
    expect(within(dialog).getByText("2 of 3")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Second" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(dialog).getAllByRole("button")).toHaveLength(4);
    fireEvent.click(within(dialog).getByRole("button", { name: "Third" }));
    expect(within(dialog).getByAltText("Third")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByAltText("First")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(within(dialog).getByAltText("Third")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Second" }));
    expect(within(dialog).getByRole("button", { name: "Third" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(dialog).getByText("2 of 3")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await act(async () => {
      fireEvent.doubleClick(screen.getByAltText("First"));
    });
    expect(within(await screen.findByRole("dialog")).getByText("1 of 3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close preview"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
