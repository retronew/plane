import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import en from "../../../../../packages/i18n/src/locales/en/web.json";
import zh from "../../../../../packages/i18n/src/locales/zh-CN/web.json";
import { CollaborationUsers, PageCollaborationUsers } from "./collaboration-users";
import { PageEditorInstance } from "../../../store/pages/page-editor-info";
import type { EditorRefApi } from "@plane/editor";
import { act } from "react";
const locale = vi.hoisted(() => ({ language: "zh" }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === "common.unknown_user") return "未知用户";
      const source = locale.language === "zh" ? zh.web : en.web;
      const text = source[key.replace("web.", "") as keyof typeof source];
      if (typeof text !== "string") throw new Error(key);
      return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name]));
    },
  }),
}));
vi.mock("@plane/utils", () => ({ getFileURL: (value: string | null) => value ?? undefined }));
afterEach(() => {
  cleanup();
  locale.language = "zh";
});
const users = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `Member ${i}`, avatar: null }));
it("renders current user first, a keyboard-focusable group and accessible overflow names", async () => {
  render(<CollaborationUsers users={users} currentUserId="2" />);
  const group = screen.getByRole("group", { name: "正在编辑此页面" });
  group.focus();
  expect(document.activeElement).toBe(group);
  expect(group.querySelector('[aria-label="Member 2（您）"]')).toBeTruthy();
  expect(screen.getByRole("img", { name: "另外 3 位编辑者" })).toBeTruthy();
  const counter = screen.getByRole("img", { name: "另外 3 位编辑者" });
  counter.focus();
  fireEvent.focus(counter);
  expect(document.activeElement).toBe(counter);
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.textContent).toContain("Member 3");
  expect(tooltip.textContent).toContain("Member 4");
  expect(tooltip.textContent).toContain("Member 5");
});
it("updates with store events and removes all faces on disconnect/unmount", () => {
  const editor = new PageEditorInstance();
  let emit = (_: typeof users) => {};
  editor.setEditorRef({
    getCollaborationUsers: () => users.slice(0, 2),
    onCollaborationUsersChange: (cb) => {
      emit = cb;
      return () => {};
    },
  } as EditorRefApi);
  render(<PageCollaborationUsers editor={editor} currentUserId="0" />);
  expect(screen.getByLabelText("正在编辑此页面")).toBeTruthy();
  act(() => emit([]));
  expect(screen.queryByLabelText("正在编辑此页面")).toBeNull();
  act(() => emit(users));
  expect(screen.getByLabelText("正在编辑此页面")).toBeTruthy();
  act(() => editor.setEditorRef(null));
  expect(screen.queryByLabelText("正在编辑此页面")).toBeNull();
});
it("renders English labels and hides empty groups", () => {
  locale.language = "en";
  const { rerender } = render(<CollaborationUsers users={users.slice(0, 1)} currentUserId="0" />);
  expect(screen.getByLabelText("Member 0 (you)")).toBeTruthy();
  rerender(<CollaborationUsers users={[]} />);
  expect(screen.queryByLabelText("Editing this page")).toBeNull();
});
