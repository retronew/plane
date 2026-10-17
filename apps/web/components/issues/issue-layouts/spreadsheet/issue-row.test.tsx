import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { SpreadsheetIssueRow } from "./issue-row";
import { SpreadsheetLayoutLoader } from "@/components/ui/loader/layouts/spreadsheet-layout-loader";

const issue = { id: "issue-1", name: "Work item", project_id: "project-1", sequence_id: 1, type_id: "bug" };
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({
    issueTypes: {
      "project-1": {
        results: [{ id: "bug", name: "Bug", logo_props: { in_use: "emoji", emoji: { value: "128027" } } }],
      },
    },
  }),
}));
vi.mock("use-font-face-observer", () => ({ default: () => true }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", projectId: "project-1" }) }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issueMap: { "issue-1": issue } }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: { getIssueById: () => issue },
    subIssues: { subIssuesByIssueId: () => [] },
    getIsIssuePeeked: () => false,
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectIdentifierById: () => "TEST" }) }));
vi.mock("@/hooks/use-issue-peek-overview-redirection", () => ({ default: () => ({ handleRedirection: vi.fn() }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("../row-expansion", () => ({ useIssueRowExpansion: () => [false, vi.fn()] }));
vi.mock("../utils", () => ({ isIssueNew: () => true }));
vi.mock("./issue-column", () => ({ IssueColumn: () => <td className="border-r border-b border-subtle">Property</td> }));
vi.mock("@/components/core/multiple-select", () => ({ MultipleSelectEntityAction: () => null }));
vi.mock("@/components/core/render-if-visible-HOC", () => ({
  default: ({ children, classNames }: { children: ReactNode; classNames: string }) => (
    <tr className={classNames}>{children}</tr>
  ),
}));

const selectionHelpers = {
  getIsEntitySelected: () => false,
  getIsEntityActive: () => false,
  isSelectionDisabled: true,
} as unknown as TSelectionHelper;

describe("Spreadsheet grid boundaries", () => {
  it.each([false, true])("keeps the trailing blank cell inside its row when scrolled=%s", (scrolled) => {
    const { container } = render(
      <table>
        <tbody>
          <SpreadsheetIssueRow
            issueId={issue.id}
            displayProperties={{ key: true }}
            isEstimateEnabled={false}
            quickActions={() => <></>}
            canEditProperties={() => false}
            updateIssue={undefined}
            portalElement={{ current: null }}
            containerRef={{ current: null }}
            nestingLevel={0}
            isScrolled={{ current: scrolled }}
            spreadsheetColumnsList={["state"]}
            selectionHelpers={selectionHelpers}
          />
        </tbody>
      </table>
    );
    expect(container.querySelectorAll("tbody > td")).toHaveLength(0);
    expect(container.querySelectorAll("tr")).toHaveLength(1);
    const cells = container.querySelectorAll("tr > td");
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(cell.classList.contains("border-b")).toBe(true);
      expect(cell.classList.contains("border-subtle")).toBe(true);
    }
    expect(cells[2].getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[data-work-item-type-icon="bug"]')?.textContent).toBe(String.fromCodePoint(128027));
    const identifier = container.querySelector("[data-spreadsheet-identifier]");
    expect(identifier?.textContent).toBe("TEST-1");
    expect(identifier?.classList.contains("text-caption-md-medium!")).toBe(true);
    expect(identifier?.classList.contains("max-w-[20ch]")).toBe(true);
    expect((cells[0] as HTMLElement).style.boxShadow).toBe(scrolled ? "var(--shadow-direction-right)" : "");
  });

  it("draws loader boundaries on table cells with the same width and semantic color", () => {
    const { container } = render(<SpreadsheetLayoutLoader columnCount={2} />);
    const table = container.querySelector("table");
    expect(table?.classList.contains("border-separate")).toBe(true);
    expect(table?.classList.contains("border-spacing-0")).toBe(true);
    for (const cell of container.querySelectorAll("th, td")) {
      expect(cell.classList.contains("border-b")).toBe(true);
      expect(cell.classList.contains("border-r")).toBe(true);
      expect(cell.classList.contains("border-subtle")).toBe(true);
      expect(cell.classList.contains("flex")).toBe(false);
    }
  });
});
