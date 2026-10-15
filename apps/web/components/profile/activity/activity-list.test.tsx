import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { IIssueActivity, IUserActivityResponse } from "@plane/types";
import { ActivityList } from "./activity-list";

const editor = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "actor" } }) }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "ws" }) }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({ workspaceLabels: [], fetchWorkspaceLabels: vi.fn() }),
}));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: (props: unknown) => {
    editor(props);
    return <div>Comment body</div>;
  },
}));
vi.mock("@/components/ui/loader/settings/activity", () => ({
  ActivitySettingsLoader: () => <output>Loading activity</output>,
}));
const item = (overrides: Partial<IIssueActivity> = {}): IIssueActivity =>
  ({
    id: "activity",
    field: null,
    verb: "created",
    old_value: "",
    new_value: "",
    created_at: new Date("2026-10-14T10:00:00Z"),
    project: "project",
    issue: "issue",
    actor_detail: { id: "actor", display_name: "QA user", is_bot: false },
    workspace_detail: { slug: "workspace" },
    project_detail: { identifier: "QA" },
    issue_detail: { name: "Created work item", sequence_id: "7" },
    ...overrides,
  }) as IIssueActivity;
const response = (...results: IIssueActivity[]) => ({ results }) as IUserActivityResponse;
beforeEach(async () => {
  await setLanguage("zh-CN");
  editor.mockClear();
});
afterEach(async () => {
  await act(() => setLanguage("en"));
});
it("renders creation and label changes with valid links and independent timestamps; hides internal updates", () => {
  const { container } = render(
    <ActivityList
      activity={response(
        item(),
        item({ id: "label", field: "labels", new_value: "Design", new_identifier: "label" }),
        item({ id: "internal", field: "updated_by" })
      )}
    />
  );
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByRole("link", { name: /QA-7/ }).getAttribute("href")).toBe("/workspace/browse/QA-7/");
  expect(rows[0].textContent).toContain("您 创建了");
  expect(within(rows[1]).getByText("Design")).toBeTruthy();
  expect(container.querySelectorAll("time")).toHaveLength(2);
  expect(container.querySelector("p time")).toBeNull();
  expect(container.querySelector("time")?.dateTime).toBe("2026-10-14T10:00:00.000Z");
});
it("keeps comments in list rows with their original read-only content and workspace context", () => {
  render(<ActivityList activity={response(item({ field: "comment", new_value: "<p>Saved comment</p>" }))} />);
  expect(within(screen.getByRole("listitem")).getByText("Comment body")).toBeTruthy();
  expect(editor).toHaveBeenCalledWith(
    expect.objectContaining({
      editable: false,
      initialValue: "<p>Saved comment</p>",
      workspaceId: "ws",
      workspaceSlug: "workspace",
      projectId: "project",
    })
  );
});
it("shows the loading state until activity arrives", () => {
  const { rerender } = render(<ActivityList activity={undefined} />);
  expect(screen.getByRole("status")).toBeTruthy();
  rerender(<ActivityList activity={response()} />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("list").children).toHaveLength(0);
});
