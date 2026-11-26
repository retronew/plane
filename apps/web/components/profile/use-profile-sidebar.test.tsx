import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useProfileSidebar } from "./use-profile-sidebar";

beforeEach(() => localStorage.clear());

it("starts expanded on desktop and restores the user's choice after remount", () => {
  localStorage.setItem("profile_sidebar_collapsed", "true"); // legacy automatic mobile value
  const first = renderHook(() => useProfileSidebar(true));
  expect(first.result.current.open).toBe(true);
  act(first.result.current.toggle);
  first.unmount();
  const second = renderHook(() => useProfileSidebar(true));
  expect(second.result.current.open).toBe(false);
  act(second.result.current.toggle);
  expect(second.result.current.open).toBe(true);
});

it("opens and dismisses the mobile panel without changing the desktop preference", () => {
  const { result, rerender } = renderHook((desktop) => useProfileSidebar(desktop), { initialProps: true });
  act(result.current.toggle);
  rerender(false);
  expect(result.current.open).toBe(false);
  act(result.current.toggle);
  expect(result.current.open).toBe(true);
  act(result.current.closeMobile);
  rerender(true);
  expect(result.current.open).toBe(false);
});
