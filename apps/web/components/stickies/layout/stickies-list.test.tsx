import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StickiesList } from "./stickies-list";

const mock = vi.hoisted(() => ({ ids: ["second", "first", "third"], loader: "loaded", search: "" }));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ usePathname: () => "/workspace/stickies/" }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@/hooks/use-stickies", () => ({
  useSticky: () => ({
    getWorkspaceStickyIds: () => mock.ids,
    loader: mock.loader,
    searchQuery: mock.search,
  }),
}));
vi.mock("../sticky/use-operations", () => ({ useStickyOperations: () => ({ stickyOperations: {} }) }));
vi.mock("./sticky-dnd-wrapper", () => ({
  StickyDNDWrapper: ({ stickyId }: { stickyId: string }) => <article>{stickyId}</article>,
}));
vi.mock("@/components/empty-state/simple-empty-state-root", () => ({
  SimpleEmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));
vi.mock("@/components/empty-state/detailed-empty-state-root", () => ({
  DetailedEmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));
vi.mock("@/components/home/widgets/empty-states/stickies", () => ({ StickiesEmptyState: () => null }));
vi.mock("./stickies-loader", () => ({ StickiesLoader: () => <p>Loading</p> }));

beforeEach(() => {
  mock.ids = ["second", "first", "third"];
  mock.loader = "loaded";
  mock.search = "";
});
it("preserves store ordering and keeps the pagination target after the notes", () => {
  render(<StickiesList workspaceSlug="workspace" intersectionElement={<p>Load more</p>} />);
  expect(screen.getAllByRole("article").map((card) => card.textContent)).toEqual(mock.ids);
  expect(screen.getByText("Load more").previousElementSibling?.textContent).toBe("third");
});
it("keeps search empty states separate from an empty workspace", () => {
  mock.ids = [];
  mock.search = "missing";
  render(<StickiesList workspaceSlug="workspace" />);
  expect(screen.getByText("stickies.empty_state.search.title")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
});
