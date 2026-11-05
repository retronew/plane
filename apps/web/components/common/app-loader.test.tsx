import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./logo-spinner", () => ({ LogoSpinner: () => <span>Loading</span> }));
afterEach(() => {
  cleanup();
  vi.resetModules();
});

it("keeps a remounted boot loader hidden after an application error", async () => {
  const { BootLoader } = await import("./app-loader");
  const { finishBoot, BOOT_LOADER_ID } = await import("./boot-loader-state");
  const first = render(<BootLoader />);
  finishBoot();
  expect(document.getElementById(BOOT_LOADER_ID)?.hidden).toBe(true);
  first.unmount();
  render(
    <StrictMode>
      <BootLoader />
    </StrictMode>
  );
  expect(document.getElementById(BOOT_LOADER_ID)?.hidden).toBe(true);
});

it("does not cover an error page when boot finishes before the loader mounts", async () => {
  const { BootLoader } = await import("./app-loader");
  const { finishBoot, BOOT_LOADER_ID } = await import("./boot-loader-state");
  finishBoot();
  render(<BootLoader />);
  expect(document.getElementById(BOOT_LOADER_ID)?.hidden).toBe(true);
});
