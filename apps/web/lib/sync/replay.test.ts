/* eslint-disable no-await-in-loop -- Drain chained async replay work without advancing timers. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SyncEngine } from "./engine";
import { ReplayCoordinator, type ReplayPage } from "./replay";
const page = (cursor: string, events: ReplayPage["events"] = [], has_more = false): ReplayPage => ({
  cursor,
  events,
  has_more,
  reset_required: false,
  project_ids: ["p"],
});
const event = (cursor: string) => ({
  type: "invalidate" as const,
  protocol_version: 1 as const,
  cursor,
  project_id: "p",
  event_id: cursor,
  issue_ids: ["i"],
  changed_fields: ["name"],
});
const drain = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function setup() {
  const engine = { apply: vi.fn().mockResolvedValue(undefined), updateProjects: vi.fn() };
  const source = vi.fn().mockResolvedValue(page("10"));
  const replay = new ReplayCoordinator(engine as unknown as SyncEngine, source);
  return { engine, source, replay };
}
it("fixes baseline before snapshots, recovers missed notifications and drains pages", async () => {
  const { engine, source, replay } = setup();
  replay.resume();
  await drain();
  expect(source.mock.calls.map((call) => call[0])).toEqual([undefined, "10"]);
  expect(engine.apply).toHaveBeenCalledWith(undefined, { reset: true });
  source.mockResolvedValueOnce(page("12", [event("12")], true)).mockResolvedValueOnce(page("14", [event("14")]));
  replay.wake();
  await drain();
  expect(source.mock.calls.at(-1)?.[0]).toBe("12");
  expect(engine.apply).toHaveBeenLastCalledWith("p", { issueIds: ["i"], changedFields: ["name"], reset: false });
  replay.dispose();
});
it("keeps the cursor on failed application and retries the same page", async () => {
  const { engine, source, replay } = setup();
  replay.resume();
  await drain();
  source.mockResolvedValue(page("11", [event("11")]));
  engine.apply.mockRejectedValueOnce(new Error("REST failed"));
  replay.wake();
  await drain();
  await vi.advanceTimersByTimeAsync(2000);
  expect(source.mock.calls.slice(-2).map((call) => call[0])).toEqual(["10", "10"]);
  replay.dispose();
});
it("recalibrates an out-of-order page without applying it", async () => {
  const { engine, source, replay } = setup();
  replay.resume();
  await drain();
  engine.apply.mockClear();
  source.mockResolvedValueOnce(page("12", [event("12"), event("11")])).mockResolvedValue(page("15"));
  replay.wake();
  await drain();
  expect(engine.apply).toHaveBeenCalledTimes(1);
  expect(engine.apply).toHaveBeenCalledWith(undefined, { reset: true });
  expect(source.mock.calls.slice(-2).map((call) => call[0])).toEqual([undefined, "15"]);
  replay.dispose();
});
it("makes no hidden requests and aborts in-flight reads", async () => {
  const { source, replay } = setup();
  let finish!: (value: ReplayPage) => void;
  source.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  replay.resume();
  replay.suspend();
  expect(source.mock.calls[0][1].aborted).toBe(true);
  replay.wake();
  await vi.advanceTimersByTimeAsync(60000);
  expect(source).toHaveBeenCalledTimes(1);
  finish(page("10"));
  await drain();
  replay.resume();
  await drain();
  expect(source.mock.calls[1][0]).toBeUndefined();
  replay.dispose();
});

it("coalesces a page of 100 commits into one project application", async () => {
  const { engine, source, replay } = setup();
  replay.resume();
  await drain();
  engine.apply.mockClear();
  source.mockResolvedValue(
    page(
      "110",
      Array.from({ length: 100 }, (_, i) => ({ ...event(String(i + 11)), issue_ids: [String(i)] }))
    )
  );
  replay.wake();
  await drain();
  expect(engine.apply).toHaveBeenCalledTimes(1);
  expect(engine.apply.mock.calls[0][1].issueIds).toHaveLength(100);
  expect(engine.apply.mock.calls[0][1].changedFields).toEqual(["name"]);
  replay.dispose();
});
it("recalibrates a retention gap from the returned baseline", async () => {
  const { engine, source, replay } = setup();
  replay.resume();
  await drain();
  engine.apply.mockClear();
  source.mockResolvedValueOnce({ ...page("50"), reset_required: true }).mockResolvedValue(page("50"));
  replay.wake();
  await drain();
  expect(engine.apply).toHaveBeenCalledWith(undefined, { reset: true });
  expect(source.mock.calls.at(-1)?.[0]).toBe("50");
  replay.dispose();
});
