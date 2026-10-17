import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ICycle } from "@plane/types";
import { CycleSidebarHeader } from "./sidebar-header";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
  getCurrentLanguage: () => "zh-CN",
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => true }),
  useUserProfile: () => ({ data: {} }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({ updateCycleDetails: vi.fn() }) }));
vi.mock("@/hooks/use-timezone-converter", () => ({
  useTimeZoneConverter: () => ({ renderFormattedDateInUserTimezone: (date: string) => date }),
}));
vi.mock("@plane/blocks/property-select", () => ({
  DateRangeSelect: ({
    disabled,
    formatLabel,
  }: {
    disabled: boolean;
    formatLabel: (range: { from: Date; to: Date }) => string;
  }) => (
    <button disabled={disabled} aria-label="cycle dates">
      {formatLabel({ from: new Date(2026, 9, 8), to: new Date(2026, 9, 23) })}
    </button>
  ),
}));

it.each([
  ["upcoming", "yet_to_start", "bg-accent-subtle", "text-accent-primary", false],
  ["current", "in_progress", "bg-warning-subtle", "text-warning-primary", false],
  ["completed", "completed", "bg-success-subtle", "text-success-primary", true],
  ["draft", "draft", "bg-surface-2", "text-tertiary", false],
] as const)(
  "renders the %s status with its shared colors and date permissions",
  (status, key, background, color, disabled) => {
    render(
      <CycleSidebarHeader
        workspaceSlug="demo"
        projectId="project"
        cycleDetails={{ id: "cycle", name: "Cycle", status } as ICycle}
        handleClose={vi.fn()}
      />
    );
    const heading = screen.getByRole("heading", { name: "Cycle" });
    const closeButton = screen.getByRole("button", { name: "close" });
    expect(heading.parentElement).toBe(closeButton.parentElement);
    expect(heading.parentElement?.classList.contains("items-start")).toBe(true);
    expect(closeButton.classList.contains("bg-layer-3")).toBe(true);
    const badge = screen.getByText(`project_cycles.status.${key}`);
    expect(badge.classList.contains(background)).toBe(true);
    expect(badge.classList.contains(color)).toBe(true);
    const dateButton = screen.getByRole("button", { name: "cycle dates" }) as HTMLButtonElement;
    expect(dateButton.disabled).toBe(disabled);
    expect(dateButton.textContent?.match(/2026/g)).toHaveLength(1);
  }
);
