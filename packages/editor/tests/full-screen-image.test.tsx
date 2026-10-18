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
vi.mock("@plane/utils", () => ({ cn: (value: string) => value }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
