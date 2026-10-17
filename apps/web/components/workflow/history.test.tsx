import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TWorkflowActivity, TWorkflowHistoryPage } from "@plane/types";
import { calculateTimeAgo, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { HistorySnapshot, memberSnapshotChanges, WorkflowHistory } from "./history";
const historyCss = readFileSync(`${import.meta.dirname}/history.module.css`, "utf8");

const state = vi.hoisted(() => ({ history: vi.fn(), historyRevision: {} as Record<string, number> }));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({ historyRevision: state.historyRevision, service: { history: state.history } }),
}));

beforeEach(async () => {
  await setLanguage("zh-CN");
  state.history.mockReset().mockResolvedValue(page([]));
  state.historyRevision = {};
  vi.stubGlobal("PointerEvent", MouseEvent);
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
afterEach(() => vi.unstubAllGlobals());

const entry = (action: string, data: TWorkflowActivity["data"] = {}, id = "h"): TWorkflowActivity => ({
  id,
  action,
  data,
  actor_id: null,
  actor_name: "Admin",
  created_at: "2026-10-16T00:00:00Z",
});
const page = (results: TWorkflowActivity[], extra: Partial<TWorkflowHistoryPage> = {}): TWorkflowHistoryPage => ({
  results,
  count: results.length,
  next_offset: null,
  ...extra,
});

function renderHistory(initial: { open?: boolean; workflowId?: string; onClose?: () => void } = {}) {
  const cache = new Map();
  const props = { open: true, workflowId: "flow-a", onClose: vi.fn(), ...initial };
  function tree() {
    return (
      <MemoryRouter>
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
          <div className="relative">
            <WorkflowHistory {...props} workspaceSlug="workspace" projectId="project" />
          </div>
        </SWRConfig>
      </MemoryRouter>
    );
  }
  const view = render(tree());
  return {
    ...view,
    onClose: props.onClose,
    update: (next: Partial<typeof props>) => {
      Object.assign(props, next);
      view.rerender(tree());
    },
  };
}

it("renders metadata values without misleading member snapshots", () => {
  render(
    <HistorySnapshot
      entry={entry("created", { schema_version: 2, after: { name: "QA flow", state_ids: ["todo", "done"] } })}
    />
  );
  expect(screen.getByText(/名称: QA flow/)).toBeTruthy();
  expect(screen.queryByText(/未记录/)).toBeNull();
});
it("does not reserve a snapshot row for legacy or empty records", () => {
  const view = render(<HistorySnapshot entry={entry("initial", { state_name: "Todo" })} />);
  expect(view.container.childElementCount).toBe(0);
  view.rerender(<HistorySnapshot entry={entry("updated", { schema_version: 2 })} />);
  expect(view.container.childElementCount).toBe(0);
});
it("renders migration counts and state mapping", () => {
  render(
    <HistorySnapshot
      entry={entry("migration", {
        schema_version: 2,
        before: { operation: "delete_workflow" },
        after: { affected_count: 3, state_mapping: { old: "new" } },
      })}
    />
  );
  expect(screen.getByText(/受影响工作项数: 3/)).toBeTruthy();
  expect(screen.getByText(/old.*new/)).toBeTruthy();
});
it("compares historical member snapshots without resolving current members", () => {
  const changes = memberSnapshotChanges(
    { members: [{ id: "a", name: "Old" }] },
    { members: [{ id: "b", name: "New" }] }
  );
  expect(changes).toEqual({ added: [{ id: "b", name: "New" }], removed: [{ id: "a", name: "Old" }] });
});
it("preserves transition and approval details and historical member changes", () => {
  render(
    <HistorySnapshot
      entry={entry("transition_updated", {
        schema_version: 2,
        before: {
          source: { id: "todo", name: "Todo" },
          destination: { id: "done", name: "Done" },
          member_mode: "explicit",
          members: [{ id: "a", name: "Old" }],
        },
        after: {
          source: { id: "todo", name: "Todo" },
          destination: { id: "done", name: "Done" },
          member_mode: "explicit",
          members: [{ id: "b", name: "New" }],
          kind: "approval",
          approver_mode: "explicit",
          approvers: [{ id: "approver", name: "Historical approver" }],
        },
      })}
    />
  );
  expect(screen.getAllByText(/Todo → Done/)).toHaveLength(2);
  expect(screen.getByText(/Historical approver/)).toBeTruthy();
  expect(screen.getByText(/新增成员.*New/)).toBeTruthy();
  expect(screen.getByText(/移除成员.*Old/)).toBeTruthy();
});
it("renders a connected timeline with action icons, actor links and relative dates", async () => {
  state.history.mockResolvedValue(
    page([
      { ...entry("creation", { state_name: "Todo", value: true }, "creation"), actor_id: "actor" },
      entry("initial", { state_name: "Done" }, "initial"),
      entry("enabled", { value: false }, "enabled"),
      entry("transition_added", { source_name: "Todo", destination_name: "Done" }, "transition"),
    ])
  );
  renderHistory();
  const rows = await screen.findAllByRole("listitem");
  expect(rows).toHaveLength(4);
  const actor = within(rows[0]).getByRole("link", { name: "Admin" });
  expect(actor.getAttribute("href")).toBe("/workspace/profile/actor/");
  expect(screen.queryByText(/未记录/)).toBeNull();
  expect(rows.map((row) => row.querySelector("svg path")?.getAttribute("d"))).toEqual(
    expect.arrayContaining([expect.any(String), expect.any(String), expect.any(String), expect.any(String)])
  );
  expect(rows[0].querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24");
  expect(rows[0].querySelector("svg path")?.getAttribute("d")).toContain("16.5953");
  expect(rows[1].querySelector("svg path")?.getAttribute("d")).toContain("3.483-2.442");
  expect(rows[2].querySelector("svg")?.innerHTML).toBe(rows[3].querySelector("svg")?.innerHTML);
  rows.forEach((row) => {
    expect(row.querySelector("span[aria-hidden='true']")).not.toBeNull();
    expect(within(row).getByText(calculateTimeAgo("2026-10-16T00:00:00Z"))).toBeTruthy();
  });
  const time = rows[0].querySelector("time")!;
  expect(time.dateTime).toBe("2026-10-16T00:00:00Z");
  fireEvent.focus(time);
  expect((await screen.findByRole("tooltip")).textContent).toBe(
    `${renderFormattedDate(time.dateTime)}, ${renderFormattedTime(time.dateTime)}`
  );
});
it("loads the next cursor page, deduplicates entries and ends the timeline at the last row", async () => {
  state.history
    .mockResolvedValueOnce(page([entry("created", {}, "one")], { next_cursor: "cursor-1", watermark: "watermark-1" }))
    .mockResolvedValueOnce(page([entry("created", {}, "one"), entry("updated", {}, "two")]));
  renderHistory();
  fireEvent.click(await screen.findByRole("button", { name: "加载更多" }));
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  expect(state.history).toHaveBeenLastCalledWith("workspace", "project", 0, {
    workflowId: "flow-a",
    direction: "desc",
    cursor: "cursor-1",
    watermark: "watermark-1",
  });
  expect(screen.queryByRole("button", { name: "加载更多" })).toBeNull();
  expect(screen.getAllByRole("listitem")[1].querySelector("span[aria-hidden='true']")).not.toBeNull();
});
it("keeps offset pagination and resets to the first page when sorting", async () => {
  state.history
    .mockResolvedValueOnce(page([entry("created")], { next_offset: 10 }))
    .mockResolvedValueOnce(page([entry("updated", {}, "next")]))
    .mockResolvedValueOnce(page([entry("initial", { state_name: "Sorted state" }, "sorted")]));
  renderHistory();
  fireEvent.click(await screen.findByRole("button", { name: "加载更多" }));
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  expect(state.history).toHaveBeenNthCalledWith(2, "workspace", "project", 10, {
    workflowId: "flow-a",
    direction: "desc",
    cursor: undefined,
    watermark: undefined,
  });
  fireEvent.click(screen.getByRole("button", { name: "排序" }));
  await screen.findByText(/Sorted state/);
  expect(state.history).toHaveBeenLastCalledWith("workspace", "project", 0, {
    workflowId: "flow-a",
    direction: "asc",
    cursor: undefined,
    watermark: undefined,
  });
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});
it("retries failed requests without showing the empty state", async () => {
  state.history.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(page([entry("created")]));
  renderHistory();
  const retry = await screen.findByRole("button", { name: "重试" });
  expect(screen.queryByText("暂无变更记录")).toBeNull();
  fireEvent.click(retry);
  await screen.findByRole("listitem");
  expect(state.history).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
});
it("does not fetch while closed and supports closing and reopening the retained workflow", async () => {
  const view = renderHistory({ open: false });
  expect(state.history).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  view.update({ open: true });
  await screen.findByText("暂无变更记录");
  expect(screen.getByRole("dialog").querySelector("h2")?.textContent).toBe("变更历史");
  fireEvent.click(screen.getByRole("button", { name: "关闭" }));
  expect(view.onClose).toHaveBeenCalledTimes(1);
  view.update({ open: false });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const closedCalls = state.history.mock.calls.length;
  state.historyRevision.project = 1;
  view.update({ open: false });
  await act(async () => {});
  expect(state.history).toHaveBeenCalledTimes(closedCalls);
  view.update({ open: true });
  await screen.findByText("暂无变更记录");
  await waitFor(() => expect(state.history).toHaveBeenCalledTimes(closedCalls + 1));
  expect(state.history).toHaveBeenLastCalledWith("workspace", "project", 0, {
    workflowId: "flow-a",
    direction: "desc",
    cursor: undefined,
    watermark: undefined,
  });
});
it("retains the timeline until the closing slide finishes", async () => {
  state.history.mockResolvedValue(page([entry("initial", { state_name: "Retained state" })]));
  const view = renderHistory();
  await screen.findByText(/Retained state/);
  await waitFor(() => expect(screen.getByRole("dialog").hasAttribute("data-starting-style")).toBe(false));
  let finishSlide!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishSlide = resolve;
  });
  const getAnimations = vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
    return this.hasAttribute("data-ending-style") ? ([{ finished }] as unknown as Animation[]) : [];
  });
  try {
    view.update({ open: false });
    await waitFor(() =>
      expect(
        getAnimations.mock.contexts.some(
          (element) => element instanceof Element && element.hasAttribute("data-ending-style")
        )
      ).toBe(true)
    );
    expect(screen.getByRole("dialog").hasAttribute("data-ending-style")).toBe(true);
    expect(screen.getByText(/Retained state/)).toBeTruthy();
    await act(async () => finishSlide());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  } finally {
    getAnimations.mockRestore();
  }
});
it("uses local CSS to slide both lifecycle states independently of Tailwind generation", () => {
  const sheet = document.createElement("style");
  sheet.textContent = historyCss.replace(/:global\(([^)]+)\)/g, "$1");
  document.head.append(sheet);
  const panel = document.createElement("div");
  panel.setAttribute("data-workflow-history", "");
  document.body.append(panel);
  panel.innerHTML = `<ol>${Array.from({ length: 3 }, () => '<li class="activity"><span class="connector"></span></li>').join("")}</ol>`;
  try {
    const rows = panel.querySelectorAll("li");
    expect(getComputedStyle(rows[0]).paddingTop).toBe("0px");
    expect(getComputedStyle(rows[0]).paddingBottom).toBe("12px");
    expect(getComputedStyle(rows[1]).paddingTop).toBe("12px");
    expect(getComputedStyle(rows[1]).paddingBottom).toBe("12px");
    expect(getComputedStyle(rows[2]).paddingBottom).toBe("0px");
    expect(getComputedStyle(rows[0].firstElementChild!).top).toBe("16px");
    expect(getComputedStyle(rows[1].firstElementChild!).top).toBe("0px");
    expect(getComputedStyle(rows[2].firstElementChild!).bottom).toBe("calc(100% - 28px)");
    expect(getComputedStyle(panel).width).toBe("368px");
    expect(getComputedStyle(panel).translate).toBe("0");
    expect(getComputedStyle(panel).paddingBlock).toBe("8px 16px");
    expect(getComputedStyle(panel).transition).toContain("translate 400ms cubic-bezier(0.16, 1, 0.3, 1)");
    for (const attribute of ["data-starting-style", "data-ending-style"]) {
      panel.setAttribute(attribute, "");
      expect(getComputedStyle(panel).translate).toBe("100% 0");
      panel.removeAttribute(attribute);
      expect(getComputedStyle(panel).translate).toBe("0");
    }
  } finally {
    panel.remove();
    sheet.remove();
  }
});
