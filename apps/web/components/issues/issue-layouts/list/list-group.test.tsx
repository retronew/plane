import { act, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ListGroup } from "./list-group";
import { KanbanGroup } from "../kanban/kanban-group";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  cleanup: vi.fn(),
  count: 1,
  workflow: vi.fn(),
  toast: vi.fn(),
  column: vi.fn(),
  translate: (key: string) => key,
}));
vi.mock("@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter", () => ({ dropTargetForElements: mocks.register }));
vi.mock("@/components/workflow", () => ({
  useWorkFlowFDragNDrop: () => ({
    handleWorkFlowState: mocks.workflow,
    isWorkflowDropDisabled: false,
    getIsWorkflowWorkItemCreationDisabled: () => false,
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => ({}) }));
vi.mock("@/hooks/use-issue-layout-store", () => ({
  useIssuesStore: () => ({
    issues: { getGroupIssueCount: () => mocks.count, getPaginationData: () => ({}), getIssueLoader: () => false },
  }),
}));
vi.mock("@/hooks/use-intersection-observer", () => ({ useIntersectionObserver: vi.fn() }));
vi.mock("@/components/core/visibility-observer-boundary", () => ({ useCollapsibleVisibilityUpdates: vi.fn() }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("../utils", () => ({
  getSourceFromDropPayload: () => ({ id: "i", groupId: "source" }),
  getDestinationFromDropPayload: () => ({ groupId: "g" }),
  getIssueBlockId: () => "i",
  highlightIssueOnDrop: vi.fn(),
}));
vi.mock("@atlaskit/pragmatic-drag-and-drop-auto-scroll/element", () => ({ autoScrollForElements: () => () => {} }));
vi.mock("../kanban/blocks-list", () => ({ KanbanIssueBlocksList: () => null }));
vi.mock("../kanban/kanban-dnd", () => ({
  useKanbanColumnDnd: (input: { issueIds: string[] }) => {
    mocks.column(input);
    return {
      ref: () => {},
      issueIds: input.issueIds,
      activeIssueId: null,
      activeSourceColumnId: null,
      isDraggingOverColumn: false,
    };
  },
}));
vi.mock("./blocks-list", () => ({ IssueBlocksList: () => null }));
vi.mock("./headers/group-by-card", () => ({ HeaderGroupByCard: () => null }));
vi.mock("../group-drag-overlay", () => ({ GroupDragOverlay: () => null }));
vi.mock("../quick-add", () => ({ ListQuickAddIssueButton: () => null, QuickAddIssueRoot: () => null }));
const makeProps = () =>
  ({
    group: { id: "g" },
    group_by: "state",
    orderBy: "sort_order",
    issuesMap: {},
    getGroupIndex: () => 0,
    handleOnDrop: vi.fn(),
    handleCollapsedGroups: vi.fn(),
    collapsedGroups: { group_by: [] },
    containerRef: { current: null },
    loadMoreIssues: vi.fn(),
    enableIssueQuickAdd: false,
  }) as unknown as ComponentProps<typeof ListGroup>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.count = 1;
  mocks.register.mockReturnValue(mocks.cleanup);
});
it("uses current drop callbacks and collapsed state without replacing the target", () => {
  const props = makeProps();
  const view = render(<ListGroup {...props} />);
  const target = mocks.register.mock.calls[0][0];
  const nextDrop = vi.fn();
  const expand = vi.fn();
  view.rerender(
    <ListGroup
      {...props}
      handleOnDrop={nextDrop}
      handleCollapsedGroups={expand}
      collapsedGroups={{ group_by: ["g"] } as typeof props.collapsedGroups}
    />
  );
  expect(mocks.register).toHaveBeenCalledTimes(1);
  act(() => target.onDrop({}));
  expect(nextDrop).toHaveBeenCalledOnce();
  expect(props.handleOnDrop).not.toHaveBeenCalled();
  expect(expand).toHaveBeenCalledWith("g");
  view.unmount();
  expect(mocks.cleanup).toHaveBeenCalledOnce();
});
it("registers when a previously empty hidden group appears and cleans up when hidden", () => {
  const props = makeProps();
  mocks.count = 0;
  const view = render(<ListGroup {...props} />);
  expect(mocks.register).not.toHaveBeenCalled();
  mocks.count = 1;
  view.rerender(<ListGroup {...props} group={{ ...props.group }} />);
  expect(mocks.register).toHaveBeenCalledOnce();
  mocks.count = 0;
  view.rerender(<ListGroup {...props} group={{ ...props.group }} />);
  expect(mocks.cleanup).toHaveBeenCalledOnce();
});

it("uses the current issue type and workflow callback during an existing drag", () => {
  const props = makeProps();
  const view = render(<ListGroup {...props} />);
  const target = mocks.register.mock.calls[0][0];
  const workflow = vi.fn();
  mocks.workflow = workflow;
  view.rerender(
    <ListGroup {...props} issuesMap={{ i: { type_id: "new-type" } } as unknown as typeof props.issuesMap} />
  );
  act(() => target.onDrag({ source: { data: { id: "i", groupId: "source" } } }));
  expect(workflow).toHaveBeenCalledWith("source", "g", undefined, undefined, "new-type");
  expect(mocks.register).toHaveBeenCalledOnce();
});

it("uses the current translation and rejects a newly disabled drop without re-registering", () => {
  const props = makeProps();
  const view = render(<ListGroup {...props} />);
  const target = mocks.register.mock.calls[0][0];
  mocks.translate = (key: string) => `translated:${key}`;
  view.rerender(<ListGroup {...props} group={{ ...props.group, isDropDisabled: true, dropErrorMessage: "blocked" }} />);
  act(() => target.onDrop({}));
  expect(props.handleOnDrop).not.toHaveBeenCalled();
  expect(mocks.toast).toHaveBeenCalledWith({ type: "warning", title: "translated:common.warning", message: "blocked" });
  expect(mocks.register).toHaveBeenCalledOnce();
});

it("refuses Kanban drops into a disabled column, silently without an error message", () => {
  const props = {
    groupId: "g",
    sub_group_id: "null",
    issuesMap: {},
    groupedIssueIds: {},
    isDropDisabled: true,
  } as unknown as ComponentProps<typeof KanbanGroup>;
  const view = render(<KanbanGroup {...props} />);
  const getDropError = () => mocks.column.mock.lastCall?.[0].getDropError();
  expect(mocks.column.mock.lastCall?.[0]).toMatchObject({ columnId: "g__null", groupId: "g", subGroupId: "null" });
  expect(getDropError()).toBeNull();
  view.rerender(<KanbanGroup {...props} dropErrorMessage="blocked" />);
  expect(getDropError()).toBe("blocked");
  view.rerender(<KanbanGroup {...props} isDropDisabled={false} />);
  expect(getDropError()).toBeUndefined();
});
