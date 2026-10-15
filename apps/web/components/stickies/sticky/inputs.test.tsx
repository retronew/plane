import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StickyInput } from "./inputs";

const locale = vi.hoisted(() => ({ value: "zh-CN" }));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: () => (locale.value === "zh-CN" ? "点击此处输入" : "click to type here") }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/workspace/" }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace-1" }) }),
}));
vi.mock("@/components/editor/sticky-editor", () => ({
  StickyEditor: ({
    placeholder,
    onChange,
  }: {
    placeholder: (focused: boolean, html: string) => string;
    onChange: (text: string, html: string) => void;
  }) => (
    <>
      <span data-testid="empty">{placeholder(false, "<p></p>")}</span>
      <span data-testid="populated">{placeholder(true, "<p>QA note</p>")}</span>
      <button type="button" onClick={() => onChange("QA note", "<p>QA note</p>")}>
        Type
      </button>
    </>
  ),
}));
const update = vi.fn();
function mount() {
  render(
    <StickyInput
      stickyData={{ description_html: "<p></p>" }}
      workspaceSlug="workspace"
      stickyId="sticky-1"
      handleUpdate={update}
      handleChange={vi.fn()}
      handleDelete={vi.fn()}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  locale.value = "zh-CN";
});
it.each([
  ["zh-CN", "点击此处输入"],
  ["en", "click to type here"],
])("uses the %s placeholder only for empty content", (language, placeholder) => {
  locale.value = language;
  mount();
  expect(screen.getByTestId("empty").textContent).toBe(placeholder);
  expect(screen.getByTestId("populated").textContent).toBe("");
});
it("preserves saving edited HTML", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Type" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ description_html: "<p>QA note</p>" }));
});
