import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ICycle } from "@plane/types";
import { CycleListItemAction } from "./cycle-list-item-action";

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "project" }),
  usePathname: () => "/demo/projects/project/cycles",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({}) }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => false }),
  useUserProfile: () => ({ data: {} }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: (id: string) => ({ id, display_name: id }) }),
}));
vi.mock("@/hooks/use-timezone-converter", () => ({
  useTimeZoneConverter: () => ({
    isProjectTimeZoneDifferent: () => false,
    getProjectUTCOffset: () => "UTC+8",
    renderFormattedDateInUserTimezone: (value: string) => value,
  }),
}));
vi.mock("@/components/dropdowns/member/avatar", () => ({
  ButtonAvatars: ({ userIds }: { userIds: string }) => <span data-testid="cycle-owner">{userIds}</span>,
}));
vi.mock("@/components/dropdowns/merged-date", () => ({
  MergedDateDisplay: () => <span>October 1 – October 18</span>,
}));
vi.mock("../quick-actions", () => ({ CycleQuickActions: () => <button>cycle-options</button> }));
vi.mock("../transfer-issues-modal", () => ({ TransferIssuesModal: () => null }));

it("centers the active date, timezone and actual owner together, even when the creator differs", () => {
  render(
    <CycleListItemAction
      workspaceSlug="demo"
      projectId="project"
      cycleId="cycle"
      cycleDetails={
        {
          id: "cycle",
          status: "current",
          owned_by_id: "owner",
          created_by: "creator",
          total_issues: 10,
          completed_issues: 5,
          cancelled_issues: 0,
        } as unknown as ICycle
      }
      parentRef={createRef<HTMLDivElement>()}
      isActive
    />
  );
  const owner = screen.getByTestId("cycle-owner");
  expect(owner.textContent).toBe("owner");
  expect(owner.parentElement?.classList.contains("items-center")).toBe(true);
  expect(owner.parentElement?.contains(screen.getByText("UTC+8"))).toBe(true);
  expect(owner.parentElement?.contains(screen.getByText("October 1 – October 18"))).toBe(true);
  expect(screen.queryByRole("button", { name: "project_cycles.more_details" })).toBeNull();
  expect(screen.getByRole("button", { name: "cycle-options" })).toBeTruthy();
});
