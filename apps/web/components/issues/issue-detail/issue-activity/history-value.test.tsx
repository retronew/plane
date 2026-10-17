import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { IntakeHistoryValue } from "./history-value";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "无" }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: (id: string) => (id === "member-id" ? { display_name: "Alice" } : undefined) }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: (id: string) => (id === "state-id" ? { name: "Done" } : undefined) }),
}));
it.each([
  ["assignees", "member-id", "Alice"],
  ["assignees", "Bob", "Bob"],
  ["state", "state-id", "Done"],
  ["state", "Triage", "Triage"],
  ["state", '{"state_id":"state-id"}', "Done"],
  ["description", "<p>Hello</p>", "Hello"],
  ["attachment", "workspace/abcdef0123456789abcdef0123456789-report.pdf", "report.pdf"],
  ["name", null, "无"],
])("formats %s history values", (field, value, label) => {
  render(<IntakeHistoryValue field={field} value={value} />);
  expect(screen.getByText(label!)).toBeTruthy();
});
