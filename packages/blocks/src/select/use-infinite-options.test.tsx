import { StrictMode, useEffect } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TPaginatedResponse } from "@plane/types";
import { useInfiniteOptions } from "./use-infinite-options";

type Option = { id: string };
type Page = TPaginatedResponse<Option[]>;
const key = (option: Option) => option.id;
const page = (id: string, cursor?: string): Page => ({
  results: [{ id }],
  next_cursor: cursor,
  next_page_results: Boolean(cursor),
});
function deferred() {
  let resolve!: (value: Page) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Page>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useInfiniteOptions request lifetime", () => {
  it.each(["resolve", "reject"] as const)("discards a pending %s after close", async (settle) => {
    const pending = deferred();
    const { result } = renderHook(() => useInfiniteOptions(() => pending.promise, key));
    act(() => result.current.onOpen());
    act(() => result.current.onClose());
    await act(async () => {
      if (settle === "resolve") pending.resolve(page("stale", "stale-cursor"));
      else pending.reject(new Error("stale failure"));
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.errorKind).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it.each([true, false])("keeps reopened results when old response arrives first=%s", async (oldFirst) => {
    const old = deferred();
    const fresh = deferred();
    const getValues = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(() => useInfiniteOptions(getValues, key));
    act(() => result.current.onOpen());
    act(() => result.current.onClose());
    expect(result.current.isLoading).toBe(false);
    act(() => result.current.onOpen());
    expect(getValues).toHaveBeenCalledTimes(2);
    if (oldFirst) {
      await act(async () => old.resolve(page("stale", "stale-cursor")));
      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(true);
    }
    await act(async () => fresh.resolve(page("fresh")));
    if (!oldFirst) await act(async () => old.resolve(page("stale", "stale-cursor")));
    expect(result.current.items).toEqual([{ id: "fresh" }]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });

  it("does not consume a response after unmount", async () => {
    const pending = deferred();
    const readResults = vi.fn(() => [{ id: "stale" }]);
    const response: Page = {
      get results() {
        return readResults();
      },
    };
    const { result, unmount } = renderHook(() => useInfiniteOptions(() => pending.promise, key));
    act(() => result.current.onOpen());
    unmount();
    await act(async () => pending.resolve(response));
    expect(readResults).not.toHaveBeenCalled();
  });

  it("refetches across StrictMode effect replay and discards the first response", async () => {
    const old = deferred();
    const fresh = deferred();
    const getValues = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(
      () => {
        const options = useInfiniteOptions(getValues, key);
        const { onOpen } = options;
        useEffect(() => onOpen(), [onOpen]);
        return options;
      },
      { wrapper: StrictMode }
    );
    expect(getValues).toHaveBeenCalledTimes(2);
    await act(async () => old.resolve(page("stale")));
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await act(async () => fresh.resolve(page("fresh")));
    expect(result.current.items).toEqual([{ id: "fresh" }]);
  });

  it("preserves deduplication and retries the failed append cursor", async () => {
    const failure = new Error("offline");
    const getValues = vi
      .fn()
      .mockResolvedValueOnce(page("one", "page-2"))
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ results: [{ id: "one" }, { id: "two" }], next_page_results: false });
    const { result } = renderHook(() => useInfiniteOptions(getValues, key));
    await act(async () => result.current.onOpen());
    await act(async () => result.current.onLoadMore());
    expect(result.current.items).toEqual([{ id: "one" }]);
    expect(result.current.errorKind).toBe("append");
    act(() => result.current.onLoadMore());
    expect(getValues).toHaveBeenCalledTimes(2);
    await act(async () => result.current.onRetry());
    expect(getValues).toHaveBeenLastCalledWith({ cursor: "page-2", search: undefined });
    expect(result.current.items).toEqual([{ id: "one" }, { id: "two" }]);
    expect(result.current.error).toBeNull();
  });
});
