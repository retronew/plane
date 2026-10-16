import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MATERIAL_ICONS_LIST } from "./material-icons";
import { LUCIDE_ICONS_LIST } from "./lucide-icons";
import { matchesIconSearch } from "./search";
import { getIconBackgroundStyle } from "./icon-background";
import { MaterialIconList } from "./icon/material-root";
import { LucideIconsList } from "./icon/lucide-root";
vi.mock("use-font-face-observer", () => ({ default: () => true }));

describe("expanded icon picker", () => {
  it("keeps unique persisted IDs and provides a renderable Lucide component for every entry", () => {
    expect(MATERIAL_ICONS_LIST.length).toBeGreaterThan(400);
    expect(LUCIDE_ICONS_LIST.length).toBeGreaterThan(300);
    for (const icons of [MATERIAL_ICONS_LIST, LUCIDE_ICONS_LIST])
      expect(new Set(icons.map((icon) => icon.name)).size).toBe(icons.length);
    for (const icon of LUCIDE_ICONS_LIST) expect(icon.element).toBeDefined();
  });
  it("matches Chinese topics and spaced English names without changing stored IDs", () => {
    expect(matchesIconSearch("rocket_launch", "火箭")).toBe(true);
    expect(matchesIconSearch("rocket_launch", "rocket launch")).toBe(true);
    expect(matchesIconSearch("FolderKanban", "folder kanban")).toBe(true);
    expect(matchesIconSearch("home", "   ")).toBe(true);
    expect(matchesIconSearch("home", "不存在的图标")).toBe(false);
  });
  it("selects expanded material icons with the chosen color", () => {
    const onChange = vi.fn();
    render(<MaterialIconList query="火箭" activeColor="#5e6ad2" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "rocket_launch" }));
    expect(onChange).toHaveBeenCalledWith({ name: "rocket_launch", color: "#5e6ad2" });
  });
  it("shows an explicit empty state for unmatched Lucide searches", () => {
    render(<LucideIconsList query="does-not-exist-icon" activeColor="#5e6ad2" onChange={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("composites icon tint over the theme surface and rejects invalid color values", () => {
    expect(getIconBackgroundStyle({ in_use: "icon", icon: { color: "#5e6ad2" } })?.backgroundColor).toBe(
      "color-mix(in srgb, #5e6ad2 12.5%, var(--background-color-layer-2))"
    );
    expect(getIconBackgroundStyle({ in_use: "emoji", emoji: { value: "1f680" } })).toBeUndefined();
    expect(getIconBackgroundStyle({ in_use: "icon", icon: { color: "invalid" } })).toBeUndefined();
  });
});

it("honors a persisted cleared or explicit background", () => {
  expect(
    getIconBackgroundStyle({ in_use: "icon", icon: { color: "#5e6ad2", background_color: "transparent" } })
  ).toEqual({ backgroundColor: "transparent" });
  expect(getIconBackgroundStyle({ in_use: "icon", icon: { color: "#5e6ad2", background_color: "#ffffff" } })).toEqual({
    backgroundColor: "#ffffff",
  });
});
