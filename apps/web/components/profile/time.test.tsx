import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileSidebarTime } from "./time";

const language = vi.hoisted(() => ({ current: "en" }));
vi.mock("@plane/i18n", () => ({ getCurrentLanguage: () => language.current }));
vi.mock("@/hooks/use-current-time", () => ({
  useCurrentTime: () => ({ currentTime: new Date("2026-01-01T00:05:00Z") }),
}));
afterEach(cleanup);

it("keeps timezone and h23 options distinct across cached formatters", () => {
  const view = render(<ProfileSidebarTime timeZone="UTC" />);
  expect(screen.getByText("00:05")).toBeTruthy();
  view.rerender(<ProfileSidebarTime timeZone="America/Los_Angeles" />);
  expect(screen.getByText("16:05")).toBeTruthy();
  language.current = "zh-CN";
  view.rerender(<ProfileSidebarTime timeZone="Asia/Shanghai" />);
  expect(screen.getByText("08:05")).toBeTruthy();
  view.rerender(<ProfileSidebarTime timeZone="UTC" />);
  expect(screen.getByText("00:05")).toBeTruthy();
  language.current = "en";
});
