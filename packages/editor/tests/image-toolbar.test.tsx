import React, { StrictMode } from "react";
import type { Editor } from "@tiptap/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ImageToolbarRoot } from "../src/extensions/custom-image/components/toolbar/root";

vi.mock("@makeplane/propel/icons", () => ({ ChevronDownOutline: () => null, FullScreenOutline: () => null }));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/utils", () => ({
  cn: (base: string, states: Record<string, boolean>) =>
    `${base} ${Object.entries(states)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(" ")}`,
}));
vi.mock("@plane/hooks", () => ({ useOutsideClickDetector: () => undefined }));
vi.mock("../src/extensions/custom-image/utils", () => ({
  IMAGE_ALIGNMENT_OPTIONS: [{ value: "left", label: "Left", icon: () => null }],
}));
vi.mock("../src/extensions/custom-image/components/toolbar/download", () => ({ ImageDownloadAction: () => null }));
vi.mock("../src/extensions/custom-image/components/toolbar/full-screen/modal", () => ({
  ImageFullScreenModal: ({
    isFullScreenEnabled,
    toggleFullScreenMode,
  }: {
    isFullScreenEnabled: boolean;
    toggleFullScreenMode: (open: boolean) => void;
  }) => (isFullScreenEnabled ? <button onClick={() => toggleFullScreenMode(false)}>Close viewer</button> : null),
}));

afterEach(cleanup);
const editor = { isEditable: true } as Editor;
const props = {
  alignment: "left" as const,
  editor,
  aspectRatio: 2,
  downloadSrc: "/download",
  handleAlignmentChange: vi.fn(),
  height: "100px",
  isTouchDevice: false,
  src: "/image",
  width: "200px",
};
const view = (editable = true) => (
  <StrictMode>
    <ImageToolbarRoot {...props} editor={{ ...editor, isEditable: editable } as Editor} />
  </StrictMode>
);

it("keeps overlay visibility consistent across open, replacement, close and read-only unmount", () => {
  const { rerender, container, unmount } = render(view());
  const toolbar = container.firstElementChild!;
  fireEvent.click(screen.getByRole("button", { name: "web.align" }));
  expect(toolbar.classList.contains("opacity-100")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "web.view_image_in_full_screen" }));
  expect(screen.queryByRole("button", { name: "Left" })).toBeNull();
  expect(toolbar.classList.contains("opacity-100")).toBe(true);
  fireEvent.click(screen.getByText("Close viewer"));
  expect(toolbar.classList.contains("opacity-100")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "web.align" }));
  rerender(view(false));
  expect(toolbar.classList.contains("opacity-100")).toBe(false);
  rerender(view());
  expect(screen.getByRole("button", { name: "web.align" }).getAttribute("aria-expanded")).toBe("false");
  unmount();
  render(view());
  expect(screen.getByRole("button", { name: "web.align" }).getAttribute("aria-expanded")).toBe("false");
});

it("closes alignment with Escape and restores trigger focus", () => {
  render(view());
  const trigger = screen.getByRole("button", { name: "web.align" });
  fireEvent.click(trigger);
  const option = screen.getByRole("button", { name: "Left" });
  option.focus();
  fireEvent.keyDown(option, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "Left" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
