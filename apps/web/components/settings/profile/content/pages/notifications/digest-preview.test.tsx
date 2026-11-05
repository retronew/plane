import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { setLanguage } from "@plane/i18n";
import type { TDailyDigestPreview } from "@plane/types";
import { DigestPreview } from "./digest-preview";

it("shows the user's local period, complete counts and capped detail links", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  const digest: TDailyDigestPreview = {
    period_start: "2026-11-04T10:00:00Z",
    period_end: "2026-11-05T10:00:00Z",
    timezone: "Asia/Shanghai",
    sections: [
      {
        key: "overdue",
        count: 5,
        items: [
          {
            id: "item",
            name: "Review release",
            identifier: "WEB-1",
            workspace_slug: "team",
            project_id: "project",
            target_date: "2026-11-03",
          },
        ],
      },
    ],
  };
  render(
    <MemoryRouter>
      <DigestPreview digest={digest} />
    </MemoryRouter>
  );
  expect(screen.getByText(/Asia\/Shanghai/).textContent).toContain("6:00 PM");
  expect(screen.getByText("5 work items")).toBeTruthy();
  expect(screen.getByText("4 more work items")).toBeTruthy();
  expect(screen.getByRole("link", { name: "WEB-1 Review release" }).getAttribute("href")).toBe(
    "/team/projects/project/issues/item"
  );
});

it("renders counts-only summaries without creating work item links", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  render(
    <MemoryRouter>
      <DigestPreview
        digest={{
          period_start: "2026-11-04T10:00:00Z",
          period_end: "2026-11-05T10:00:00Z",
          timezone: "UTC",
          sections: [{ key: "completed", count: 3, items: [] }],
        }}
      />
    </MemoryRouter>
  );
  expect(screen.getByText("Completed this period")).toBeTruthy();
  expect(screen.getByText("3 work items")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});

it("keeps long detail lists compact and expands without changing totals", async () => {
  await act(async () => {
    await setLanguage("en");
  });
  const items = Array.from({ length: 8 }, (_, index) => ({
    id: String(index),
    name: `Task ${index}`,
    identifier: `WEB-${index}`,
    workspace_slug: "team",
    project_id: "project",
    target_date: null,
  }));
  render(
    <MemoryRouter>
      <DigestPreview
        digest={{
          period_start: "2026-11-04T10:00:00Z",
          period_end: "2026-11-05T10:00:00Z",
          timezone: "UTC",
          sections: [{ key: "open", count: 12, items }],
        }}
      />
    </MemoryRouter>
  );
  expect(screen.getAllByRole("link")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Show all 8" }));
  expect(screen.getAllByRole("link")).toHaveLength(8);
  expect(screen.getByText("12 work items")).toBeTruthy();
  expect(screen.getByText("4 more work items")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
  expect(screen.getAllByRole("link")).toHaveLength(3);
});
