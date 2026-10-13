/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLastWorkPath } from "./use-last-work-path";

const route = vi.hoisted(() => ({ slug: "acme", pathname: "/acme/", search: "" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: route.slug }),
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search),
}));

const STORAGE_KEY = "APP_RAIL_LAST_WORK_PATH_acme";

const visit = (pathname: string, search = "") => {
  route.pathname = pathname;
  route.search = search;
};

describe("useLastWorkPath", () => {
  beforeEach(() => {
    route.slug = "acme";
    visit("/acme/");
  });

  it("falls back to the workspace home when nothing was visited", () => {
    visit("/acme/notifications/");
    const { result } = renderHook(() => useLastWorkPath());
    expect(result.current).toBe("/acme/");
  });

  it("remembers the last work page together with its query", () => {
    visit("/acme/projects/p1/issues/", "layout=board");
    const { result, rerender } = renderHook(() => useLastWorkPath());
    visit("/acme/notifications/");
    rerender();
    expect(result.current).toBe("/acme/projects/p1/issues/?layout=board");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("/acme/projects/p1/issues/?layout=board");
  });

  it("does not record the inbox or settings pages", () => {
    visit("/acme/projects/p1/issues/");
    const { result, rerender } = renderHook(() => useLastWorkPath());
    visit("/acme/settings/members/");
    rerender();
    visit("/acme/notifications/");
    rerender();
    expect(result.current).toBe("/acme/projects/p1/issues/");
  });

  it("restores the stored path after a reload", () => {
    sessionStorage.setItem(STORAGE_KEY, "/acme/cycles/");
    visit("/acme/notifications/");
    const { result } = renderHook(() => useLastWorkPath());
    expect(result.current).toBe("/acme/cycles/");
  });

  it("ignores a stored path that points outside the workspace", () => {
    sessionStorage.setItem(STORAGE_KEY, "https://evil.example/");
    visit("/acme/notifications/");
    const { result } = renderHook(() => useLastWorkPath());
    expect(result.current).toBe("/acme/");
  });

  it("falls back to the workspace home when storage is unavailable", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    visit("/acme/notifications/");
    const { result } = renderHook(() => useLastWorkPath());
    expect(result.current).toBe("/acme/");
    expect(getItem).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
