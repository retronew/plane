import React, { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ImageFullScreenModal } from "../src/extensions/custom-image/components/toolbar/full-screen/modal";

vi.mock("@makeplane/propel/icons", () => ({
  AddOutline: () => null,
  CloseOutline: () => null,
  DownloadOutline: () => null,
  MinusOutline: () => null,
  NewTabOutline: () => null,
}));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/utils", () => ({
  cn: (value: string, states: Record<string, boolean>) =>
    `${value} ${Object.entries(states)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(" ")}`,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("closes during dragging, resets on reopening and removes keyboard handlers on unmount", () => {
  const onClose = vi.fn();
  const props = {
    aspectRatio: 2,
    downloadSrc: "/download",
    isFullScreenEnabled: true,
    isTouchDevice: false,
    src: "/image",
    toggleFullScreenMode: onClose,
    width: "200px",
  };
  const { rerender, unmount } = render(
    <StrictMode>
      <ImageFullScreenModal {...props} />
    </StrictMode>
  );
  const image = screen.getByRole("img");
  Object.defineProperty(image, "offsetWidth", { value: 2000 });
  fireEvent.mouseDown(image, { clientX: 10, clientY: 10 });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(
    <StrictMode>
      <ImageFullScreenModal {...props} isFullScreenEnabled={false} />
    </StrictMode>
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(
    <StrictMode>
      <ImageFullScreenModal {...props} />
    </StrictMode>
  );
  expect(screen.getByText("100%")).toBeTruthy();
  const reopenedImage = screen.getByRole("img");
  Object.defineProperty(reopenedImage, "offsetWidth", { value: 2000 });
  fireEvent.mouseDown(reopenedImage);
  rerender(
    <StrictMode>
      <ImageFullScreenModal {...props} isFullScreenEnabled={false} />
    </StrictMode>
  );
  rerender(
    <StrictMode>
      <ImageFullScreenModal {...props} />
    </StrictMode>
  );
  expect(screen.getByRole("dialog").classList.contains("cursor-grabbing")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "web.close_image_viewer" }));
  expect(onClose).toHaveBeenCalledTimes(2);
  unmount();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("resets the pan at the original zoom without updater side effects under StrictMode", () => {
  const onClose = vi.fn();
  render(
    <StrictMode>
      <ImageFullScreenModal
        aspectRatio={2}
        downloadSrc="/download"
        isFullScreenEnabled
        isTouchDevice={false}
        src="/image"
        toggleFullScreenMode={onClose}
        width="200px"
      />
    </StrictMode>
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  const image = screen.getByRole("img") as HTMLImageElement;
  fireEvent.click(screen.getByRole("button", { name: "web.zoom_in" }));
  expect(screen.getByText("150%")).toBeTruthy();
  image.style.left = "40px";
  image.style.top = "20px";
  fireEvent.click(screen.getByRole("button", { name: "web.zoom_out" }));
  expect(screen.getByText("100%")).toBeTruthy();
  expect(image.style.left).toBe("0px");
  expect(image.style.top).toBe("0px");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledWith(false);
});
