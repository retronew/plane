/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TProjectOverviewActivity, TProjectOverviewActivityPage } from "@plane/types";
import { ProjectOverviewActivity } from "./activity";
import { useRefreshProjectActivities } from "./use-refresh-activities";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@plane/i18n", () => ({
  getCurrentLanguage: () => "en",
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => (params?.field ? `${key} ${params.field}` : key),
  }),
}));
vi.mock("@/services/project/project-overview.service", () => ({
  projectOverviewKey: (slug: string, project: string, resource: string) => [
    "project-overview",
    slug,
    project,
    resource,
  ],
  projectOverviewService: { getActivities: mocks.list },
}));
const key = "web.project_overview";
const entry: TProjectOverviewActivity = {
  id: "a",
  actor: "ada",
  actor_detail: { id: "ada", display_name: "Ada", first_name: "Ada", last_name: "", avatar_url: "", is_bot: false },
  created_at: "2026-10-17T09:00:00Z",
  verb: "updated",
  field: "name",
  old_value: "Before",
  new_value: "After",
};
const page = (results: TProjectOverviewActivity[], cursor = ""): TProjectOverviewActivityPage => ({
  results,
  next_cursor: cursor,
  next_page_results: Boolean(cursor),
});
const namedEntry = (name: string): TProjectOverviewActivity => ({
  ...entry,
  actor_detail: { ...entry.actor_detail!, display_name: name },
  new_value: name,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue(page([entry]));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Refresh() {
  const refresh = useRefreshProjectActivities("workspace", "project");
  return <button onClick={() => void refresh()}>Refresh resources</button>;
}
function setup(refresh = false) {
  const cache = new Map();
  const view = (projectId = "project") => (
    <MemoryRouter>
      <SWRConfig
        value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false, focusThrottleInterval: 0 }}
      >
        <ProjectOverviewActivity workspaceSlug="workspace" projectId={projectId} />
        {refresh && <Refresh />}
      </SWRConfig>
    </MemoryRouter>
  );
  return { ...render(view()), view, cache };
}
async function openDetails(index = 0) {
  fireEvent.click((await screen.findAllByRole("button", { name: `${key}.view_changes` }))[index]);
  return screen.findByRole("dialog", { name: `${key}.change_details` });
}
async function closeDetails() {
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^close$/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}
function toggleOrder() {
  fireEvent.click(screen.getByRole("button", { name: `${key}.sort_activity` }));
}

it("renders a compact actor/action/time timeline and reveals values only in the details dialog", async () => {
  const { container } = setup();
  const actor = await screen.findByRole("link", { name: "Ada" });
  expect(actor.getAttribute("href")).toBe("/workspace/profile/ada/");
  expect(screen.getByText(`${key}.activity_updated ${key}.activity_fields.name`, { exact: false })).toBeTruthy();
  expect(screen.queryByText("Before")).toBeNull();
  expect(screen.queryByText("After")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.querySelector("time")?.dateTime).toBe(entry.created_at);
  expect(container.querySelector("time")?.textContent).toBeTruthy();
  expect(container.querySelector("time")?.title).toBeTruthy();
  expect(mocks.list).toHaveBeenCalledWith("workspace", "project", undefined, "-created_at");

  const dialog = await openDetails();
  expect(within(dialog).getByText(`${key}.activity_old_value`)).toBeTruthy();
  expect(within(dialog).getByText(`${key}.activity_new_value`)).toBeTruthy();
  expect(within(dialog).getByText("Before")).toBeTruthy();
  expect(within(dialog).getByText("After")).toBeTruthy();
  expect(dialog.querySelector("time")?.dateTime).toBe(entry.created_at);
  await closeDetails();
  expect(screen.queryByText("Before")).toBeNull();
  expect(screen.queryByText("After")).toBeNull();
});

it("keeps change details mounted until the closing animation finishes", async () => {
  let finishAnimation!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishAnimation = resolve;
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [{ finished }],
  });
  try {
    setup();
    fireEvent.click((await screen.findAllByRole("button", { name: `${key}.view_changes` }))[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("data-starting-style")).toBe(true);
    await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));
    fireEvent.click(within(dialog).getByRole("button", { name: /^close$/ }));
    await waitFor(() => expect(dialog.hasAttribute("data-ending-style")).toBe(true));
    expect(dialog.isConnected).toBe(true);
    expect(within(dialog).getByText("Before")).toBeTruthy();
    await act(async () => finishAnimation());
    await waitFor(() => expect(dialog.isConnected).toBe(false));
  } finally {
    delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  }
});

it("loads cursor pages, locks pending requests, stops at the end and removes overlap by ID", async () => {
  let resolve!: (value: TProjectOverviewActivityPage) => void;
  mocks.list.mockImplementation(async (_slug, _id, cursor) =>
    cursor
      ? new Promise<TProjectOverviewActivityPage>((done) => {
          resolve = done;
        })
      : page([entry], "cursor-2")
  );
  const { cache } = setup();
  const more = await screen.findByRole("button", { name: `${key}.load_more` });
  fireEvent.click(more);
  fireEvent.click(more);
  await waitFor(() => expect(mocks.list).toHaveBeenCalledWith("workspace", "project", "cursor-2", "-created_at"));
  expect(screen.getByRole("button", { name: `${key}.load_more` }).getAttribute("aria-disabled")).toBe("true");
  expect(mocks.list.mock.calls.filter((call) => call[2] === "cursor-2")).toHaveLength(1);
  await act(async () => resolve(page([entry, { ...entry, id: "b", new_value: "Second page" }])));
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: `${key}.load_more` })).toBeNull();
  expect(within(await openDetails(1)).getByText("Second page")).toBeTruthy();
  await closeDetails();
  const pageArgs = [...cache.values()]
    .map((value) => value._k)
    .filter((value) => Array.isArray(value) && value.length === 6);
  expect(pageArgs).toContainEqual(["project-overview", "workspace", "project", "activities", "-created_at", ""]);
  expect(pageArgs).toContainEqual([
    "project-overview",
    "workspace",
    "project",
    "activities",
    "-created_at",
    "cursor-2",
  ]);
});

it("retains loaded entries on a failed later page and retries that cursor", async () => {
  let failed = false;
  mocks.list.mockImplementation(async (_slug, _id, cursor) => {
    if (!cursor) return page([entry], "next");
    if (!failed) {
      failed = true;
      throw new Error("offline");
    }
    return page([{ ...entry, id: "b", new_value: "Recovered" }]);
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: `${key}.load_more` }));
  await screen.findByRole("alert");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.queryByText(`${key}.no_activity`)).toBeNull();
  expect(within(await openDetails()).getByText("After")).toBeTruthy();
  await closeDetails();
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  expect(within(await openDetails(1)).getByText("Recovered")).toBeTruthy();
  await closeDetails();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.list.mock.calls.filter((call) => call[2] === "next")).toHaveLength(2);
});

it("shows initial errors without claiming no activity and recovers with retry", async () => {
  mocks.list.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(page([]));
  setup();
  await screen.findByRole("alert");
  expect(screen.queryByText(`${key}.no_activity`)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  await screen.findByText(`${key}.no_activity`);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("renders snapshot title/body/name/reaction and attachment attributes as safe text in dialogs", async () => {
  const body = "First\n\n<script>alert(1)</script>";
  const snapshots = [
    {
      field: "link",
      verb: "created",
      new_value: { id: "id", title: "<img src=x onerror=alert(1)>", url: "javascript:alert(1)" },
    },
    { field: "update", verb: "updated", new_value: { body, health: "at_risk" } },
    { field: "attachment", verb: "added", new_value: { name: "<b>file.txt</b>" } },
    { field: "attachment", verb: "deleted", new_value: { attributes: { name: "nested.txt" } } },
    { field: "reaction", verb: "deleted", new_value: { reaction: "thumbsup" } },
  ];
  mocks.list.mockResolvedValue(
    page(snapshots.map((snapshot, index) => Object.assign({}, entry, snapshot, { id: String(index), old_value: null })))
  );
  const { container } = setup();
  await screen.findAllByRole("button", { name: `${key}.view_changes` });
  expect(container.querySelector("dd, img, script, b")).toBeNull();
  expect(screen.getAllByRole("listitem")[0].textContent).toContain(`${key}.activity_added ${key}.activity_fields.link`);
  expect(screen.getAllByRole("listitem")[3].textContent).toContain(
    `${key}.activity_deleted ${key}.activity_fields.attachment`
  );
  async function checkSnapshot(index: number, value: string) {
    expect(screen.queryByText(value)).toBeNull();
    const dialog = await openDetails(index);
    const detail = [...dialog.querySelectorAll("dd")].find((node) => node.textContent === value);
    expect(detail).toBeTruthy();
    expect(detail?.closest("dl")?.classList.contains("whitespace-pre-wrap")).toBe(true);
    expect(dialog.querySelector("img, script, b, a")).toBeNull();
    expect(within(dialog).getByText("—")).toBeTruthy();
    await closeDetails();
  }
  await checkSnapshot(0, "<img src=x onerror=alert(1)>");
  await checkSnapshot(1, body);
  await checkSnapshot(2, "<b>file.txt</b>");
  await checkSnapshot(3, "nested.txt");
  await checkSnapshot(4, "thumbsup");
});

it("preserves unresolved UUIDs, booleans, numbers, lists, unknown fields and verbs accurately", async () => {
  const uuid = "a8b68e00-6ad9-489d-8bcd-448a23e57558";
  mocks.list.mockResolvedValue(
    page([
      { ...entry, actor: null, actor_detail: null, field: "status", old_value: uuid, new_value: [uuid, 0, false] },
      {
        ...entry,
        id: "unknown",
        field: "custom_field",
        verb: "restored",
        old_value: { id: uuid, enabled: false },
        new_value: [],
      },
    ])
  );
  setup();
  await screen.findByText("unknown_user");
  expect(screen.queryByRole("link", { name: "unknown_user" })).toBeNull();
  expect(screen.getByText("custom_field · restored", { exact: false })).toBeTruthy();
  const status = await openDetails();
  expect(within(status).getByText(uuid)).toBeTruthy();
  expect(within(status).getByText(`${uuid}, 0, false`)).toBeTruthy();
  await closeDetails();
  const unknown = await openDetails(1);
  expect(within(unknown).getByText(JSON.stringify({ id: uuid, enabled: false }))).toBeTruthy();
  expect(within(unknown).getByText("[]")).toBeTruthy();
});

it("fetches both sort directions from the server and keeps their six-part cache keys isolated", async () => {
  const older = { ...namedEntry("Older actor"), id: "older", created_at: "2026-10-16T09:00:00Z" };
  const newer = { ...namedEntry("Newer actor"), id: "newer" };
  let resolveOldest!: (value: TProjectOverviewActivityPage) => void;
  mocks.list.mockImplementation(async (_slug, _id, _cursor, orderBy) =>
    orderBy === "created_at"
      ? new Promise<TProjectOverviewActivityPage>((resolve) => {
          resolveOldest = resolve;
        })
      : page([newer, older])
  );
  const { cache } = setup();
  await screen.findByRole("list", { name: `${key}.newest_first` });
  await screen.findByRole("link", { name: "Newer actor" });
  expect(screen.getAllByRole("listitem").map((node) => node.querySelector("a")?.textContent)).toEqual([
    "Newer actor",
    "Older actor",
  ]);
  expect(screen.getByRole("button", { name: `${key}.sort_activity` }).getAttribute("aria-pressed")).toBe("false");
  toggleOrder();
  await waitFor(() => expect(mocks.list).toHaveBeenCalledWith("workspace", "project", undefined, "created_at"));
  expect(screen.queryByRole("link", { name: "Newer actor" })).toBeNull();
  expect(screen.getByRole("button", { name: `${key}.sort_activity` }).getAttribute("aria-pressed")).toBe("true");
  // Preserve the returned sequence even when timestamp order differs: ordering belongs to the server.
  await act(async () => resolveOldest(page([older, { ...newer, created_at: "2026-10-15T09:00:00Z" }])));
  expect(screen.getByRole("list", { name: `${key}.oldest_first` })).toBeTruthy();
  expect(screen.getAllByRole("listitem").map((node) => node.querySelector("a")?.textContent)).toEqual([
    "Older actor",
    "Newer actor",
  ]);
  const pageArgs = [...cache.values()].map((value) => value._k).filter(Array.isArray);
  expect(pageArgs).toContainEqual(["project-overview", "workspace", "project", "activities", "-created_at", ""]);
  expect(pageArgs).toContainEqual(["project-overview", "workspace", "project", "activities", "created_at", ""]);
});

it("resets pagination to the first page when switching sort directions, including cached sorts", async () => {
  mocks.list.mockImplementation(async (_slug, _id, cursor, orderBy) => {
    if (orderBy === "created_at") {
      return cursor
        ? page([{ ...namedEntry("Oldest second page"), id: "oldest-second" }])
        : page([namedEntry("Oldest first page")], "oldest-next");
    }
    return cursor
      ? page([{ ...namedEntry("Newest second page"), id: "newest-second" }])
      : page([namedEntry("Newest first page")], "newest-next");
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: `${key}.load_more` }));
  await screen.findByRole("link", { name: "Newest second page" });
  const requestsBeforeOldest = mocks.list.mock.calls.length;
  toggleOrder();
  await screen.findByRole("link", { name: "Oldest first page" });
  await waitFor(() =>
    expect(mocks.list.mock.calls.slice(requestsBeforeOldest)).toContainEqual([
      "workspace",
      "project",
      undefined,
      "created_at",
    ])
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Newest second page" })).toBeNull();
  expect(mocks.list.mock.calls.slice(requestsBeforeOldest).every((call) => call[2] === undefined)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: `${key}.load_more` }));
  await screen.findByRole("link", { name: "Oldest second page" });
  expect(mocks.list).toHaveBeenCalledWith("workspace", "project", "oldest-next", "created_at");
  const requestsBeforeSwitch = mocks.list.mock.calls.length;
  toggleOrder();
  await screen.findByRole("link", { name: "Newest first page" });
  await waitFor(() =>
    expect(mocks.list.mock.calls.slice(requestsBeforeSwitch)).toContainEqual([
      "workspace",
      "project",
      undefined,
      "-created_at",
    ])
  );
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
  expect(screen.queryByRole("link", { name: "Newest second page" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Oldest second page" })).toBeNull();
  // Resetting the departing sort may refresh its first page; neither sort should request a cursor here.
  expect(mocks.list.mock.calls.slice(requestsBeforeSwitch).every((call) => call[2] === undefined)).toBe(true);
  expect(screen.getByRole("button", { name: `${key}.load_more` })).toBeTruthy();
});

it("ignores a late cursor response from the previous sort and unlocks pagination for the new sort", async () => {
  let resolveNewest!: (value: TProjectOverviewActivityPage) => void;
  mocks.list.mockImplementation(async (_slug, _id, cursor, orderBy) => {
    if (orderBy === "created_at") {
      return cursor
        ? page([{ ...namedEntry("Oldest second page"), id: "oldest-second" }])
        : page([namedEntry("Oldest first page")], "oldest-next");
    }
    return cursor
      ? new Promise<TProjectOverviewActivityPage>((resolve) => {
          resolveNewest = resolve;
        })
      : page([entry], "newest-next");
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: `${key}.load_more` }));
  await waitFor(() => expect(mocks.list).toHaveBeenCalledWith("workspace", "project", "newest-next", "-created_at"));
  toggleOrder();
  await screen.findByRole("link", { name: "Oldest first page" });
  await act(async () => resolveNewest(page([{ ...namedEntry("Late newest page"), id: "late" }])));
  expect(screen.queryByRole("link", { name: "Late newest page" })).toBeNull();
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: `${key}.load_more` }));
  await screen.findByRole("link", { name: "Oldest second page" });
  expect(mocks.list).toHaveBeenCalledWith("workspace", "project", "oldest-next", "created_at");
  const requestsBeforeReturn = mocks.list.mock.calls.length;
  toggleOrder();
  await screen.findByRole("link", { name: "Ada" });
  await waitFor(() =>
    expect(mocks.list.mock.calls.slice(requestsBeforeReturn)).toContainEqual([
      "workspace",
      "project",
      undefined,
      "-created_at",
    ])
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Late newest page" })).toBeNull();
  expect(mocks.list.mock.calls.slice(requestsBeforeReturn).every((call) => call[2] === undefined)).toBe(true);
});

it("refreshes the six-part infinite activity through a resource-prefix mutation", async () => {
  setup(true);
  await screen.findByRole("link", { name: "Ada" });
  mocks.list.mockResolvedValue(page([namedEntry("Refreshed by resources")]));
  fireEvent.click(screen.getByRole("button", { name: "Refresh resources" }));
  await screen.findByRole("link", { name: "Refreshed by resources" });
  expect(within(await openDetails()).getByText("Refreshed by resources")).toBeTruthy();
});

it("refreshes legacy and both sorted cursor keys once and leaves other projects untouched", async () => {
  const modes = ["four", "five", "newest", "oldest", "other"] as const;
  type Mode = (typeof modes)[number];
  const fetchers = Object.fromEntries(
    modes.map((mode) => [mode, vi.fn<() => Promise<string>>().mockResolvedValue(mode)])
  ) as Record<Mode, ReturnType<typeof vi.fn<() => Promise<string>>>>;
  function Probe({ mode }: { mode: Mode }) {
    const resourceKey = ["project-overview", "workspace", mode === "other" ? "other-project" : "project", "activities"];
    if (mode === "five") resourceKey.push("");
    else if (mode === "newest" || mode === "oldest" || mode === "other") {
      resourceKey.push(mode === "oldest" ? "created_at" : "-created_at", "");
    }
    const { data } = useSWRInfinite(() => resourceKey, fetchers[mode]);
    return <span>{data?.[0]}</span>;
  }
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      {modes.map((mode) => (
        <Probe key={mode} mode={mode} />
      ))}
      <Refresh />
    </SWRConfig>
  );
  await Promise.all(modes.map((mode) => screen.findByText(mode)));
  fireEvent.click(screen.getByRole("button", { name: "Refresh resources" }));
  await waitFor(() => {
    for (const mode of modes.filter((candidate) => candidate !== "other"))
      expect(fetchers[mode]).toHaveBeenCalledTimes(2);
  });
  expect(fetchers.other).toHaveBeenCalledOnce();
});

it("revalidates after regaining focus when description/property saves happened elsewhere", async () => {
  setup();
  await screen.findByRole("link", { name: "Ada" });
  mocks.list.mockResolvedValue(page([namedEntry("Latest focus activity")]));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await screen.findByRole("link", { name: "Latest focus activity" });
  expect(within(await openDetails()).getByText("Latest focus activity")).toBeTruthy();
});

it("fetches fresh activity on remount and isolates another project's cache", async () => {
  const { rerender, view } = setup();
  await screen.findByRole("link", { name: "Ada" });
  rerender(<div />);
  mocks.list.mockResolvedValue(page([namedEntry("Latest description save")]));
  rerender(view());
  await screen.findByRole("link", { name: "Latest description save" });
  expect(within(await openDetails()).getByText("Latest description save")).toBeTruthy();
  await closeDetails();
  mocks.list.mockResolvedValue(page([namedEntry("Other project")]));
  rerender(view("other-project"));
  await screen.findByRole("link", { name: "Other project" });
  expect(mocks.list).toHaveBeenLastCalledWith("workspace", "other-project", undefined, "-created_at");
  expect(screen.queryByText("Latest description save")).toBeNull();
});
