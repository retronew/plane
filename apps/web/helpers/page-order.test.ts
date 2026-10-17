import { describe, expect, it } from "vitest";
import type { TPage, TPageFiltersSortKey } from "@plane/types";
import { orderPages, shouldFilterPage } from "@plane/utils";

const pages = [
  { id: "b", name: "beta", created_at: "2026-10-02", updated_at: "2026-10-02" },
  { id: "a", name: "Alpha", created_at: "2026-10-01", updated_at: "2026-10-01" },
  { id: "c", name: "gamma", created_at: "2026-10-03", updated_at: "2026-10-03" },
] as TPage[];

describe("page ordering", () => {
  it.each<TPageFiltersSortKey>(["name", "created_at", "updated_at"])(
    "preserves ascending and descending %s order without changing input",
    (key) => {
      expect(orderPages(pages, key, "asc").map((page) => page.id)).toEqual(["a", "b", "c"]);
      expect(orderPages(pages, key, "desc").map((page) => page.id)).toEqual(["c", "b", "a"]);
      expect(pages.map((page) => page.id)).toEqual(["b", "a", "c"]);
    }
  );
  it("preserves reverse tie ordering", () => {
    const tiedPages = pages.map((page) => ({ ...page, name: "same" }));
    expect(orderPages(tiedPages, "name", "desc").map((page) => page.id)).toEqual(["c", "a", "b"]);
  });
  it("returns no pages for empty input or an absent sort key", () => {
    expect(orderPages([], "name", "asc")).toEqual([]);
    expect(orderPages(pages, undefined, "asc")).toEqual([]);
  });
});

it("preserves created-by filter membership and combines it with favorites", () => {
  const page = { ...pages[0], owned_by: "owner", is_favorite: false } as TPage;
  expect(shouldFilterPage(page, undefined)).toBe(true);
  expect(shouldFilterPage(page, { created_by: [] })).toBe(true);
  expect(shouldFilterPage(page, { created_by: ["owner", "owner"] })).toBe(true);
  expect(shouldFilterPage(page, { created_by: ["other"] })).toBe(false);
  expect(shouldFilterPage(page, { created_by: ["owner"], favorites: true })).toBe(false);
});
