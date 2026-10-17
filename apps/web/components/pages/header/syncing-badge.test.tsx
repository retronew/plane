import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import en from "../../../../../packages/i18n/src/locales/en/web.json";
import zh from "../../../../../packages/i18n/src/locales/zh-CN/web.json";
import { PageSyncingBadge } from "./syncing-badge";

const language = vi.hoisted(() => ({ current: "zh-CN" }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      const catalog = language.current === "zh-CN" ? zh : en;
      const message = key
        .split(".")
        .reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], catalog);
      if (typeof message !== "string") throw new Error(`Missing translation: ${key}`);
      return message.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name]));
    },
  }),
}));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ label, children }: { label: string; children: ReactNode }) => (
    <>
      <span role="tooltip">{label}</span>
      {children}
    </>
  ),
}));
vi.mock("@makeplane/propel/components/badge", () => ({
  Badge: ({ label }: { label: string }) => <span>{label}</span>,
}));

afterEach(() => {
  cleanup();
  language.current = "zh-CN";
});

it.each([
  ["syncing", "正在同步…", zh.web.ui.page_syncing_tooltip],
  ["error", "连接已断开", zh.web.ui.page_connection_lost_tooltip.replace("{seconds}", "10")],
] as const)("translates the %s badge and its full tooltip", (syncStatus, label, tooltip) => {
  render(<PageSyncingBadge syncStatus={syncStatus} />);
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByRole("tooltip").textContent).toBe(tooltip);
  expect(screen.getByRole("tooltip").textContent).not.toContain("undefined");
});

it("resolves tooltip copy at render time when the language changes", () => {
  const { rerender } = render(<PageSyncingBadge syncStatus="error" />);
  language.current = "en";
  rerender(<PageSyncingBadge syncStatus="error" />);
  expect(screen.getByText(en.web.connection_lost)).toBeTruthy();
  expect(screen.getByRole("tooltip").textContent).toBe(
    en.web.ui.page_connection_lost_tooltip.replace("{seconds}", "10")
  );
});

it("shows a new sync or error immediately after the document was synced", () => {
  const { rerender } = render(<PageSyncingBadge syncStatus="synced" />);
  expect(screen.queryByRole("tooltip")).toBeNull();
  rerender(<PageSyncingBadge syncStatus="syncing" />);
  expect(screen.getByText("正在同步…")).toBeTruthy();
  rerender(<PageSyncingBadge syncStatus="synced" />);
  expect(screen.queryByRole("tooltip")).toBeNull();
  rerender(<PageSyncingBadge syncStatus="error" />);
  expect(screen.getByText("连接已断开")).toBeTruthy();
});

it("hides the connection tooltip once the document is synced", () => {
  const { rerender } = render(<PageSyncingBadge syncStatus="error" />);
  rerender(<PageSyncingBadge syncStatus="synced" />);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
