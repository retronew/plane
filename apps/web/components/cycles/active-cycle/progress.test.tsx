import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ICycle } from "@plane/types";
import { ActiveCycleProgress } from "./progress";

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@makeplane/propel/components/linear-progress", () => ({
  LinearProgress: ({ value }: { value: number }) => <progress max={100} value={value} />,
}));

it("does not count cancellation as completion in the existing project cycle view", () => {
  render(
    <ActiveCycleProgress
      workspaceSlug="demo"
      projectId="project"
      handleFiltersUpdate={() => {}}
      cycle={
        {
          total_issues: 4,
          completed_issues: 1,
          cancelled_issues: 1,
          started_issues: 1,
          backlog_issues: 1,
          unstarted_issues: 0,
        } as ICycle
      }
    />
  );
  expect((screen.getByRole("progressbar") as HTMLProgressElement).value).toBeCloseTo(100 / 3);
  expect(screen.getByText("1/3 Work item closed")).toBeTruthy();
});
