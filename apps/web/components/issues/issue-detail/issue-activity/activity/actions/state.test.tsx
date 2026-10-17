import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { IssueApprovalActivity } from "./state";
const activity = vi.hoisted(() => ({ verb: "requested" }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ activity: { getActivityById: () => activity } }),
}));
vi.mock("./", () => ({
  IssueActivityBlockComponent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IssueLink: () => null,
}));
beforeEach(async () => {
  await setLanguage("zh-CN");
});
it.each([
  ["requested", "为此工作项申请了审批"],
  ["approved", "批准了此工作项"],
  ["rejected", "拒绝了此工作项"],
])("renders %s approval activity", (verb, text) => {
  activity.verb = verb;
  render(<IssueApprovalActivity activityId="a" ends={undefined} />);
  expect(screen.getByText(text)).toBeTruthy();
});
