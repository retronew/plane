/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { IIssueActivity } from "@plane/types";
import { ActivityMessage, IssueLink } from "./activity";

const labels = vi.hoisted(() => ({ values: [{ id: "label", color: "red" }] }));

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({ workspaceLabels: labels.values, fetchWorkspaceLabels: vi.fn() }),
}));

// Only fields used to display an activity are needed for these rendering fixtures.
const activity = (overrides: Partial<IIssueActivity>): IIssueActivity =>
  ({
    field: "cycles",
    verb: "created",
    old_value: "",
    new_value: "Sprint 2",
    old_identifier: "old",
    new_identifier: "new",
    project: "project",
    issue: null,
    issue_detail: null,
    workspace_detail: { slug: "workspace" },
    ...overrides,
  }) as IIssueActivity;

describe("activity sentence localization", () => {
  beforeEach(async () => {
    await setLanguage("zh-CN");
  });
  afterEach(async () => {
    await act(async () => {
      await setLanguage("en");
    });
  });

  it.each([
    ["cycles", "created", "将此工作项添加到周期Sprint 2", "new"],
    ["cycles", "updated", "将此工作项的周期设为Sprint 2", "new"],
    ["cycles", "deleted", "从周期Sprint 1移除了此工作项", "old"],
    ["modules", "deleted", "从模块Sprint 1移除了此工作项", "old"],
  ])("renders %s %s with the correct linked value", (field, verb, expected, id) => {
    const { container } = render(<ActivityMessage activity={activity({ field, verb, old_value: "Sprint 1" })} />);
    expect(container.textContent).toBe(expected);
    expect(screen.getByRole("link").getAttribute("href")).toBe(`/workspace/projects/project/${field}/${id}`);
  });

  it("does not duplicate the intake duplicate-status explanation", () => {
    const { container } = render(<ActivityMessage activity={activity({ field: "inbox", verb: "2" })} />);
    expect(container.textContent).toBe("将此工作项标记为重复项并从收件箱拒绝");
  });

  it("translates priority values and updates full sentences when the language changes", async () => {
    const { container } = render(<ActivityMessage activity={activity({ field: "priority", new_value: "high" })} />);
    expect(container.textContent).toBe("将此工作项的优先级设为高");
    await act(async () => {
      await setLanguage("en");
    });
    expect(container.textContent).toBe("set the priority of this work item to High");
  });
});

describe("activity labels", () => {
  it.each(["", "   "])("does not reserve a color dot for an empty color %j", (color) => {
    labels.values = [{ id: "label", color }];
    const { container } = render(
      <ActivityMessage
        activity={activity({ field: "labels", new_identifier: "label", new_value: "QA label" })}
        showIssue
      />
    );
    expect(screen.getByText("QA label")).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"].rounded-full')).toBeNull();
    expect(container.querySelectorAll("[data-activity-part]")).toHaveLength(2);
  });
  it("keeps an available label color", () => {
    labels.values = [{ id: "label", color: "red" }];
    const { container } = render(
      <ActivityMessage activity={activity({ field: "labels", new_identifier: "label", new_value: "QA color" })} />
    );
    expect(container.querySelector<HTMLElement>('[aria-hidden="true"].rounded-full')?.style.backgroundColor).toBe(
      "red"
    );
  });
});

describe("removed work items", () => {
  const issue = activity({
    field: "issue",
    verb: "deleted",
    issue: "issue-1",
    project_detail: { identifier: "QA" } as IIssueActivity["project_detail"],
    issue_detail: {
      id: "issue-1",
      name: "Removed title",
      sequence_id: "4",
      description_html: "",
      priority: null,
      type_id: "type-1",
    },
  });
  it("strikes through a deleted title without leaving a navigation link", () => {
    const { container } = render(<IssueLink activity={issue} />);
    expect(container.querySelector("del")?.textContent).toBe("Removed title");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("still links an existing work item when only its label was removed", () => {
    render(<IssueLink activity={{ ...issue, field: "labels" }} />);
    expect(screen.getByRole("link").textContent).toContain("Removed title");
  });
});
