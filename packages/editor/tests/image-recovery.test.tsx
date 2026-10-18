import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/utils", () => ({ cn: () => "" }));
vi.mock("../src/extensions/custom-image/components/toolbar", () => ({ ImageToolbarRoot: () => null }));
vi.mock("../src/extensions/custom-image/components/upload-status", () => ({ ImageUploadStatus: () => null }));
import { CustomImageBlock } from "../src/extensions/custom-image/components/block";

afterEach(cleanup);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function props(touch = false) {
  return {
    editor: { isEditable: true, storage: { utility: { isTouchDevice: touch } } },
    extension: { options: { restoreImage: vi.fn(async () => {}), getImageSource: vi.fn(async () => "refreshed:a") } },
    node: { attrs: { src: "a", width: "220px", height: "110px", aspectRatio: 2 } },
    src: "view:a",
    downloadSrc: "download:a",
    selected: false,
    editorContainer: null,
    setEditorContainer: vi.fn(),
    setFailedToLoadImage: vi.fn(),
    updateAttributes: vi.fn(),
  } as unknown as ComponentProps<typeof CustomImageBlock>;
}
it("deduplicates errors while restoring and fails only after the retry fails", async () => {
  const request = deferred<void>();
  const initial = props();
  initial.extension.options.restoreImage = vi.fn(() => request.promise);
  const { container } = render(<CustomImageBlock {...initial} />);
  const image = container.querySelector("img")!;
  fireEvent.error(image);
  fireEvent.error(image);
  expect(initial.extension.options.restoreImage).toHaveBeenCalledTimes(1);
  expect(initial.setFailedToLoadImage).not.toHaveBeenCalled();
  await act(async () => request.resolve());
  expect(image.getAttribute("src")).toBe("view:a");
  fireEvent.error(image);
  expect(initial.setFailedToLoadImage).toHaveBeenCalledWith(true);
});
it("ignores a restore for an old source and allows the new source to restore", async () => {
  const request = deferred<void>();
  const initial = props();
  initial.extension.options.restoreImage = vi.fn(() => request.promise);
  const { container, rerender } = render(<CustomImageBlock {...initial} />);
  const image = container.querySelector("img")!;
  fireEvent.error(image);
  rerender(
    <CustomImageBlock
      {...initial}
      src="view:b"
      node={{ ...initial.node, attrs: { ...initial.node.attrs, src: "b" } }}
    />
  );
  await act(async () => request.resolve());
  expect(image.getAttribute("src")).toBe("view:b");
  fireEvent.error(image);
  expect(initial.extension.options.restoreImage).toHaveBeenCalledTimes(2);
  await act(async () => {});
});
it("does not write a refreshed touch URL after the source changes", async () => {
  const request = deferred<string>();
  const initial = props(true);
  initial.extension.options.getImageSource = vi.fn(() => request.promise);
  const { container, rerender } = render(<CustomImageBlock {...initial} />);
  const image = container.querySelector("img")!;
  await act(async () => fireEvent.error(image));
  rerender(<CustomImageBlock {...initial} src="view:b" />);
  await act(async () => request.resolve("refreshed:a"));
  expect(image.getAttribute("src")).toBe("view:b");
  expect(initial.setFailedToLoadImage).not.toHaveBeenCalled();
});
it("ignores restore rejection after unmount", async () => {
  const request = deferred<void>();
  const initial = props();
  initial.extension.options.restoreImage = vi.fn(() => request.promise);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const { container, unmount } = render(<CustomImageBlock {...initial} />);
  fireEvent.error(container.querySelector("img")!);
  unmount();
  await act(async () => request.reject(new Error("expired")));
  expect(initial.setFailedToLoadImage).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
});
it("refreshes touch URLs and reports unsupported restoration", async () => {
  const initial = props(true);
  const { container, rerender } = render(<CustomImageBlock {...initial} />);
  await act(async () => fireEvent.error(container.querySelector("img")!));
  expect(container.querySelector("img")!.getAttribute("src")).toBe("refreshed:a");
  rerender(
    <CustomImageBlock
      {...initial}
      src="view:b"
      extension={{ ...initial.extension, options: { ...initial.extension.options, restoreImage: undefined } }}
    />
  );
  fireEvent.error(container.querySelector("img")!);
  expect(initial.setFailedToLoadImage).toHaveBeenCalledWith(true);
});
