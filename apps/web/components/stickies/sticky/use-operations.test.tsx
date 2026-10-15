import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useStickyOperations } from "./use-operations";

const mock = vi.hoisted(() => ({
  ids: ["blank"],
  stickies: {} as Record<string, { id: string; description_html?: string }>,
  create: vi.fn(),
  toggle: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mock.toast }));
vi.mock("@/components/editor/sticky-editor/color-palette", () => ({ STICKY_COLORS_LIST: [{ key: "gray" }] }));
vi.mock("@/hooks/use-stickies", () => ({
  useSticky: () => ({
    stickies: mock.stickies,
    getWorkspaceStickyIds: () => mock.ids,
    createSticky: mock.create,
    toggleShowNewSticky: mock.toggle,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  mock.ids = ["blank"];
  mock.stickies = { blank: { id: "blank", description_html: "<p></p>" } };
});

it("explains why creating is blocked and focuses the existing blank sticky", async () => {
  const card = document.createElement("div");
  card.dataset.stickyCard = "blank";
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  editor.tabIndex = 0;
  card.append(editor);
  document.body.append(card);
  vi.spyOn(card, "getClientRects").mockReturnValue([{ width: 240 }] as unknown as DOMRectList);
  card.scrollIntoView = vi.fn();
  const { result } = renderHook(() => useStickyOperations({ workspaceSlug: "workspace" }));
  await act(() => result.current.stickyOperations.create());
  expect(mock.create).not.toHaveBeenCalled();
  expect(mock.toggle).toHaveBeenCalledWith(false);
  expect(mock.toast).toHaveBeenCalledWith({
    title: "stickies.toasts.errors.empty_title",
    message: "stickies.toasts.errors.already_exists",
    type: "warning",
  });
  expect(document.activeElement).toBe(editor);
  expect(card.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
});

it("creates a new sticky once the first sticky has content", async () => {
  mock.stickies.blank.description_html = "<p>Keep this idea</p>";
  const { result } = renderHook(() => useStickyOperations({ workspaceSlug: "workspace" }));
  await act(() => result.current.stickyOperations.create());
  expect(mock.create).toHaveBeenCalledWith("workspace", { background_color: "gray" });
});

it("allows the very first sticky and does not require a card to be mounted", async () => {
  mock.ids = [];
  const { result } = renderHook(() => useStickyOperations({ workspaceSlug: "workspace" }));
  await act(() => result.current.stickyOperations.create());
  expect(mock.create).toHaveBeenCalledOnce();
});
