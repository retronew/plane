import React, { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CustomImageNodeViewProps } from "../src/extensions/custom-image/components/node-view";
import { ECustomImageStatus } from "../src/extensions/custom-image/types";

const mocks = vi.hoisted(() => ({
  block: vi.fn(),
  uploadFile: vi.fn(),
  multiUpload: vi.fn(),
  fileMap: new Map(),
  uploadArgs: {} as Record<string, unknown>,
}));
vi.mock("@tiptap/react", () => ({ NodeViewWrapper: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("@makeplane/propel/icons", () => ({
  ImageOutline: () => null,
  RefreshOutline: () => null,
  CloseOutline: () => null,
}));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/utils", () => ({
  cn: (...values: unknown[]) => values.filter((value) => typeof value === "string").join(" "),
}));
vi.mock("../src/extensions/custom-image/utils", () => ({
  hasImageDuplicationFailed: (status: string) => status === "duplication-failed",
  getImageComponentImageFileMap: () => mocks.fileMap,
}));
vi.mock("../src/extensions/custom-image/components/block", () => ({
  CustomImageBlock: (props: { src?: string; imageFromFileSystem?: string; downloadSrc?: string }) => {
    mocks.block(props);
    return <img alt="preview" src={props.src || props.imageFromFileSystem} data-download={props.downloadSrc} />;
  },
}));
vi.mock("../src/hooks/use-file-upload", () => ({
  useUploader: (args: Record<string, unknown>) => {
    mocks.uploadArgs = args;
    return { isUploading: false, uploadFile: mocks.uploadFile };
  },
  useDropZone: () => ({ draggedInside: false, onDrop: vi.fn(), onDragEnter: vi.fn(), onDragLeave: vi.fn() }),
  uploadFirstFileAndInsertRemaining: mocks.multiUpload,
}));
import { CustomImageNodeView } from "../src/extensions/custom-image/components/node-view";
import { CustomImageUploader } from "../src/extensions/custom-image/components/uploader";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function imageProps(src = "a", status = ECustomImageStatus.UPLOADED): CustomImageNodeViewProps {
  return {
    editor: {
      isEditable: true,
      storage: { utility: {}, imageComponent: {} },
      state: { selection: { from: 0 }, doc: { nodeAt: () => null } },
    },
    extension: {
      options: {
        getImageSource: vi.fn(async (id: string) => `view:${id}`),
        getImageDownloadSource: vi.fn(async (id: string) => `download:${id}`),
        showDeleteAction: true,
      },
    },
    node: {
      attrs: { src, status, id: "image", width: "220px", height: "110px", aspectRatio: 2 },
      type: { name: "image" },
    },
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
    getPos: () => 0,
    selected: false,
  } as unknown as CustomImageNodeViewProps;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fileMap.clear();
});
afterEach(cleanup);

it("ignores an old source response after the asset changes and preserves size/delete props", async () => {
  const old = deferred<string>();
  const initial = imageProps();
  initial.extension.options.getImageSource = vi.fn((id) => (id === "a" ? old.promise : Promise.resolve("view:b")));
  const { rerender } = render(<CustomImageNodeView {...initial} />);
  const next = { ...initial, node: { ...initial.node, attrs: { ...initial.node.attrs, src: "b" } } };
  rerender(<CustomImageNodeView {...next} />);
  await waitFor(() => expect(screen.getByAltText("preview").getAttribute("src")).toBe("view:b"));
  await act(async () => old.resolve("view:a"));
  expect(screen.getByAltText("preview").getAttribute("src")).toBe("view:b");
  expect(initial.extension.options.getImageDownloadSource).not.toHaveBeenCalledWith("a");
  expect(mocks.block.mock.lastCall?.[0].node.attrs).toMatchObject({ width: "220px", height: "110px", aspectRatio: 2 });
  fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
  expect(initial.deleteNode).toHaveBeenCalledOnce();
});

it("ignores an old download failure after a source switch", async () => {
  const old = deferred<string>();
  const initial = imageProps();
  initial.extension.options.getImageDownloadSource = vi.fn((id) =>
    id === "a" ? old.promise : Promise.resolve("download:b")
  );
  const { rerender } = render(<CustomImageNodeView {...initial} />);
  await waitFor(() => expect(initial.extension.options.getImageDownloadSource).toHaveBeenCalledWith("a"));
  rerender(<CustomImageNodeView {...initial} node={{ ...initial.node, attrs: { ...initial.node.attrs, src: "b" } }} />);
  await waitFor(() => expect(screen.getByAltText("preview").getAttribute("data-download")).toBe("download:b"));
  await act(async () => old.reject(new Error("expired")));
  expect(screen.queryByText("web.runtime.image_load_error")).toBeNull();
});

it("deduplicates StrictMode duplication and never writes the previous asset", async () => {
  const old = deferred<string>();
  const current = deferred<string>();
  const initial = imageProps("a", ECustomImageStatus.DUPLICATING);
  const duplicate = vi.fn((id: string) => (id === "a" ? old.promise : current.promise));
  initial.extension.options.duplicateImage = duplicate;
  const { rerender, unmount } = render(
    <StrictMode>
      <CustomImageNodeView {...initial} />
    </StrictMode>
  );
  await waitFor(() => expect(duplicate).toHaveBeenCalledTimes(1));
  rerender(
    <StrictMode>
      <CustomImageNodeView {...initial} node={{ ...initial.node, attrs: { ...initial.node.attrs, src: "b" } }} />
    </StrictMode>
  );
  await waitFor(() => expect(duplicate).toHaveBeenCalledTimes(2));
  await act(async () => old.resolve("copy:a"));
  expect(initial.updateAttributes).not.toHaveBeenCalled();
  unmount();
  await act(async () => current.resolve("copy:b"));
  expect(initial.updateAttributes).not.toHaveBeenCalled();
});

it("keeps the active duplication subscriber when updateAttributes changes", async () => {
  const request = deferred<string>();
  const initial = imageProps("a", ECustomImageStatus.DUPLICATING);
  initial.extension.options.duplicateImage = vi.fn(() => request.promise);
  const { rerender } = render(<CustomImageNodeView {...initial} />);
  const updateAttributes = vi.fn();
  rerender(<CustomImageNodeView {...initial} updateAttributes={updateAttributes} />);
  await act(async () => request.resolve("copy:a"));
  expect(initial.extension.options.duplicateImage).toHaveBeenCalledOnce();
  expect(initial.updateAttributes).not.toHaveBeenCalled();
  expect(updateAttributes).toHaveBeenCalledWith({ src: "copy:a", status: ECustomImageStatus.UPLOADED });
});

it("uses a native picker button, passes multiple files through, and clears the preview on upload", async () => {
  const initial = imageProps("");
  const loadImageFromFileSystem = vi.fn();
  const { container } = render(
    <CustomImageUploader
      {...initial}
      failedToLoadImage={false}
      hasDuplicationFailed={false}
      maxFileSize={100}
      loadImageFromFileSystem={loadImageFromFileSystem}
    />
  );
  const input = container.querySelector("input")!;
  const click = vi.spyOn(input, "click");
  fireEvent.click(screen.getByRole("button", { name: "web.insert_an_image" }));
  expect(click).toHaveBeenCalledOnce();
  const files = [new File(["a"], "a.png"), new File(["b"], "b.png")];
  fireEvent.change(input, { target: { files } });
  await waitFor(() =>
    expect(mocks.multiUpload).toHaveBeenCalledWith(
      expect.objectContaining({ filesList: files, uploader: mocks.uploadFile, type: "image" })
    )
  );
  (mocks.uploadArgs.onUpload as (url: string) => void)("asset");
  expect(loadImageFromFileSystem).toHaveBeenCalledWith(undefined);
  expect(initial.updateAttributes).toHaveBeenCalledWith({ src: "asset", status: ECustomImageStatus.UPLOADED });
});

it("keeps retry separate from the disabled picker and disables picking in read-only mode", () => {
  const initial = imageProps();
  const uploader = {
    ...initial,
    failedToLoadImage: false,
    hasDuplicationFailed: true,
    maxFileSize: 100,
    loadImageFromFileSystem: vi.fn(),
  };
  const { rerender } = render(<CustomImageUploader {...uploader} />);
  expect((screen.getByRole("button", { name: "web.runtime.image_load_error" }) as HTMLButtonElement).disabled).toBe(
    true
  );
  fireEvent.click(screen.getByRole("button", { name: "web.retry" }));
  expect(initial.updateAttributes).toHaveBeenCalledWith({ status: ECustomImageStatus.DUPLICATING });
  rerender(
    <CustomImageUploader {...uploader} hasDuplicationFailed={false} editor={{ ...initial.editor, isEditable: false }} />
  );
  expect((screen.getByRole("button", { name: "web.insert_an_image" }) as HTMLButtonElement).disabled).toBe(true);
});
