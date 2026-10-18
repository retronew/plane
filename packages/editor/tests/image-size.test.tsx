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
function setup(alignment = "left") {
  const updateAttributes = vi.fn();
  const props = {
    editor: { isEditable: true, storage: {} },
    extension: { options: {} },
    node: { attrs: { src: "a", width: "220px", height: "110px", aspectRatio: 2, alignment } },
    src: "view:a",
    downloadSrc: "download:a",
    selected: false,
    editorContainer: document.createElement("div"),
    setEditorContainer: vi.fn(),
    setFailedToLoadImage: vi.fn(),
    updateAttributes,
  } as unknown as ComponentProps<typeof CustomImageBlock>;
  const view = render(<CustomImageBlock {...props} />);
  const image = view.container.querySelector("img")!;
  Object.defineProperties(image, { naturalWidth: { value: 400 }, naturalHeight: { value: 200 } });
  fireEvent.load(image);
  const handle = view.getByRole("button");
  image.parentElement!.getBoundingClientRect = () => ({ left: 10, right: 230 }) as DOMRect;
  return { ...view, image, handle, updateAttributes, props };
}
it("commits the latest move when move and release share a React batch", () => {
  const { handle, updateAttributes } = setup();
  fireEvent.mouseDown(handle);
  act(() => {
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 310 }));
    window.dispatchEvent(new MouseEvent("mouseup"));
  });
  expect(updateAttributes).toHaveBeenLastCalledWith({ width: "300px", height: "150px", aspectRatio: 2 });
});
it("cancels a touch gesture without persisting its draft", () => {
  const { handle, updateAttributes, image } = setup();
  fireEvent.touchStart(handle, { touches: [{ identifier: 7, clientX: 230 }] });
  fireEvent.touchMove(window, { touches: [{ identifier: 7, clientX: 310 }] });
  fireEvent.touchCancel(window, { changedTouches: [{ identifier: 7, clientX: 310 }] });
  fireEvent.mouseUp(window);
  expect(updateAttributes).not.toHaveBeenCalled();
  expect(image.style.width).toBe("220px");
});
it("resizes with arrow keys and preserves the image ratio", () => {
  const { handle, updateAttributes } = setup();
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(updateAttributes).toHaveBeenLastCalledWith({ width: "230px", height: "115px", aspectRatio: 2 });
});
it("resizes from the left edge for right-aligned images and clamps the minimum", () => {
  const { handle, updateAttributes } = setup("right");
  fireEvent.mouseDown(handle);
  fireEvent.mouseMove(window, { clientX: -70 });
  fireEvent.mouseUp(window);
  expect(updateAttributes).toHaveBeenLastCalledWith({ width: "300px", height: "150px", aspectRatio: 2 });
  fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
  expect(updateAttributes).toHaveBeenLastCalledWith({ width: "170px", height: "85px", aspectRatio: 2 });
  fireEvent.mouseDown(handle);
  fireEvent.mouseMove(window, { clientX: 400 });
  fireEvent.mouseUp(window);
  expect(updateAttributes).toHaveBeenLastCalledWith({ width: "100px", height: "50px", aspectRatio: 2 });
});
it("ignores empty touch moves and cancels on window blur", () => {
  const { handle, updateAttributes } = setup();
  fireEvent.touchStart(handle, { touches: [{ identifier: 7, clientX: 230 }] });
  fireEvent.touchMove(window, { touches: [] });
  fireEvent.blur(window);
  fireEvent.touchEnd(window, { changedTouches: [{ identifier: 7, clientX: 310 }] });
  expect(updateAttributes).not.toHaveBeenCalled();
});
it("removes gesture listeners when unmounted", () => {
  const { handle, updateAttributes, unmount } = setup();
  fireEvent.mouseDown(handle);
  unmount();
  fireEvent.mouseMove(window, { clientX: 310 });
  fireEvent.mouseUp(window);
  expect(updateAttributes).not.toHaveBeenCalled();
});

it("accumulates keyboard events in the same batch", () => {
  const { handle, updateAttributes } = setup();
  act(() => {
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  });
  expect(updateAttributes).toHaveBeenLastCalledWith({ width: "240px", height: "120px", aspectRatio: 2 });
});
it("uses actual layout width for percentage attributes", () => {
  const { props, rerender, handle, image, updateAttributes } = setup();
  rerender(<CustomImageBlock {...props} node={{ ...props.node, attrs: { ...props.node.attrs, width: "50%" } }} />);
  image.parentElement!.getBoundingClientRect = () => ({ left: 10, right: 310, width: 300 }) as DOMRect;
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(updateAttributes).toHaveBeenLastCalledWith({ width: "310px", height: "155px", aspectRatio: 2 });
});
it("invalidates loaded state and an active gesture when the source changes", () => {
  const { props, rerender, handle, updateAttributes, queryByRole } = setup();
  fireEvent.mouseDown(handle);
  fireEvent.mouseMove(window, { clientX: 310 });
  rerender(
    <CustomImageBlock {...props} src="view:b" node={{ ...props.node, attrs: { ...props.node.attrs, src: "b" } }} />
  );
  fireEvent.mouseUp(window);
  expect(updateAttributes).not.toHaveBeenCalled();
  expect(queryByRole("button")).toBeNull();
});
