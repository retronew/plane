import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IUser } from "@plane/types";
import { IssueReaction } from "./issue";

const state = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ stringToEmoji: () => "👍" }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: () => ({ display_name: "Member" }) }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    reaction: {
      getReactionsByIssueId: () => ({ "128077": ["reaction"] }),
      reactionsByUser: () => [],
      getReactionById: () => ({ actor: "member" }),
    },
    createReaction: state.create,
    removeReaction: state.remove,
  }),
}));
vi.mock("@plane/blocks/emoji-reaction", () => ({
  EmojiReactionGroup: ({
    onReactionClick,
    showAddButton,
  }: {
    onReactionClick: (emoji: string) => void;
    showAddButton: boolean;
  }) => (
    <div>
      <button onClick={() => onReactionClick("👍")}>existing reaction</button>
      {showAddButton && <button>group add</button>}
    </div>
  ),
  EmojiReactionPicker: ({
    label,
    tooltip,
    isOpen,
    handleToggle,
  }: {
    label: React.ReactNode;
    tooltip: string;
    isOpen: boolean;
    handleToggle: (open: boolean) => void;
  }) => (
    <>
      <button aria-label={tooltip} onClick={() => handleToggle(!isOpen)}>
        {label}
      </button>
      {isOpen && <dialog open>emoji picker</dialog>}
    </>
  ),
}));
const props = {
  workspaceSlug: "workspace",
  projectId: "project",
  issueId: "issue",
  currentUser: { id: "me" } as IUser,
};
beforeEach(() => vi.clearAllMocks());

it("keeps existing reactions separate from the add trigger", () => {
  const { container } = render(<IssueReaction {...props} className="mt-0" />);
  expect(container.querySelector("button button")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "existing reaction" }));
  expect(state.create).toHaveBeenCalledWith("workspace", "project", "issue", "128077");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "common.actions.add_reaction" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("hides the add trigger and blocks changes when read only", () => {
  render(<IssueReaction {...props} disabled />);
  expect(screen.queryByRole("button", { name: "common.actions.add_reaction" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "existing reaction" }));
  expect(state.create).not.toHaveBeenCalled();
});
