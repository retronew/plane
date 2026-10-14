/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { IIssueActivity } from "@plane/types";
import { ActivityMessage } from "./activity";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({ workspaceLabels: [{ id: "label", color: "red" }], fetchWorkspaceLabels: vi.fn() }),
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
