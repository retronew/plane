import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KanbanQuickAddIssueButton } from "./kanban";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("KanbanQuickAddIssueButton", () => {
  it.each([false, true])("opens quick creation without submitting a surrounding form (epic: %s)", (isEpic) => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <KanbanQuickAddIssueButton isEpic={isEpic} onClick={onClick} />
      </form>
    );
    const button = screen.getByRole("button", { name: isEpic ? "epic.new" : "issue.new" });
    expect(button.tabIndex).toBe(0);
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
