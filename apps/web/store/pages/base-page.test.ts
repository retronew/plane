import { expect, it, vi } from "vitest";
import type { TPage } from "@plane/types";
import type { RootStore } from "@/store/root.store";
import { BasePage, type TBasePageServices } from "./base-page";

function fixture() {
  const update = vi.fn().mockResolvedValue({});
  const page = new BasePage(
    { user: { data: { id: "owner" } } } as RootStore,
    { id: "page", label_ids: ["old"], is_locked: false, archived_at: null } as TPage,
    { update } as unknown as TBasePageServices
  );
  return { page, update };
}

it("sends changed properties instead of the previous snapshot and supports clearing labels", async () => {
  const { page, update } = fixture();
  await page.update({ label_ids: ["new"] });
  expect(update).toHaveBeenLastCalledWith({ label_ids: ["new"] });
  expect(page.label_ids).toEqual(["new"]);
  await page.update({ label_ids: [] });
  expect(update).toHaveBeenLastCalledWith({ label_ids: [] });
  expect(page.label_ids).toEqual([]);
  page.cleanup();
});

it("rolls back labels and preserves false and null properties on failure", async () => {
  const { page, update } = fixture();
  page.mutateProperties({ archived_at: null });
  update.mockRejectedValue(new Error("Save failed"));
  await expect(page.update({ label_ids: ["new"], is_locked: true, archived_at: "date" })).rejects.toThrow(
    "Save failed"
  );
  expect(page.label_ids).toEqual(["old"]);
  expect(page.is_locked).toBe(false);
  expect(page.archived_at).toBeNull();
  page.cleanup();
});

it("does not persist a collaborative title projection through the legacy HTTP path", async () => {
  vi.useFakeTimers();
  const { page, update } = fixture();
  try {
    page.updateTitle("Collaborative title");
    await vi.advanceTimersByTimeAsync(2500);
    expect(page.name).toBe("Collaborative title");
    expect(update).not.toHaveBeenCalled();
  } finally {
    page.cleanup();
    vi.useRealTimers();
  }
});
