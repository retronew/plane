import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApplyStateTemplate } from "./apply-template";

const mocks = vi.hoisted(() => ({ stateTemplate: vi.fn() }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Part = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
    DialogContent: Part,
    DialogMain: Part,
    DialogHeader: Part,
    DialogHeading: Part,
    DialogTitle: Part,
    DialogBody: Part,
    DialogActions: Part,
  };
});
vi.mock("@/components/settings/workspace/configuration/select", () => ({ ConfigurationSelect: () => null }));
vi.mock("@/services/workspace-configuration.service", () => ({ workspaceConfigurationService: mocks }));

it("shows all added attributes and localized changes before applying the preview token", async () => {
  const preview = {
    template: "Team states",
    disabled_state_groups: { before: [], after: ["completed"] },
    token: "signed-preview",
    matched: [
      {
        index: 0,
        id: "existing",
        values: { name: "Ready", group: "unstarted", color: "#123456", default: true, allow_new_work_items: true },
        changes: { allow_new_work_items: { before: false, after: true } },
      },
    ],
    added: [
      {
        index: 1,
        id: null,
        values: { name: "Done", group: "completed", color: "#abcdef", default: false, allow_new_work_items: false },
      },
    ],
    retained: [
      { id: "custom", name: "Custom", group: "started", changes: { default: { before: true, after: false } } },
    ],
  };
  mocks.stateTemplate.mockResolvedValue(preview);
  const onApplied = vi.fn().mockResolvedValue(undefined);
  render(<ApplyStateTemplate workspaceSlug="w" projectId="p" states={[]} onApplied={onApplied} />);
  fireEvent.click(screen.getByRole("button", { name: "web.apply_state_template" }));
  expect((screen.getByRole("button", { name: "web.state_template_apply" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "web.state_template_preview" }));
  await screen.findByText("Team states");
  expect(screen.getByText("web.allow_new_work_items: web.disabled → web.enabled")).toBeTruthy();
  expect(screen.getByText("web.default: web.enabled → web.disabled")).toBeTruthy();
  expect(
    screen.getByText("web.template_state_completed · web.allow_new_work_items: web.enabled → web.disabled")
  ).toBeTruthy();
  for (const text of [
    "web.name: Done",
    "state: web.template_state_completed",
    "web.color: #abcdef",
    "web.default: web.disabled",
    "web.allow_new_work_items: web.disabled",
  ]) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("button", { name: "web.state_template_apply" }));
  await waitFor(() => expect(onApplied).toHaveBeenCalledOnce());
  expect(mocks.stateTemplate).toHaveBeenLastCalledWith("w", "p", { mapping: {}, apply: true, token: "signed-preview" });
});
