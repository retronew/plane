import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TIssueOperations } from "./issue-detail";
import { IssueTitleInput } from "./title-input";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());
it("uses the latest fallback value when a whitespace title loses focus", () => {
  const props = {
    value: "Original title",
    workspaceSlug: "workspace",
    projectId: "project",
    issueId: "issue",
    isSubmitting: "saved" as const,
    setIsSubmitting: vi.fn(),
    issueOperations: { update: vi.fn() } as unknown as TIssueOperations,
  };
  const { rerender } = render(<IssueTitleInput {...props} />);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "   " } });
  rerender(<IssueTitleInput {...props} value={null} />);
  fireEvent.blur(input);
  expect(input.value).toBe("");
  expect(props.setIsSubmitting).toHaveBeenLastCalledWith("saved");
  expect(props.issueOperations.update).not.toHaveBeenCalled();
});
it("keeps Intake title typography identical when editing and read only", () => {
  const props = {
    value: "Intake title",
    workspaceSlug: "workspace",
    projectId: "project",
    issueId: "issue",
    isSubmitting: "saved" as const,
    setIsSubmitting: vi.fn(),
    issueOperations: { update: vi.fn() } as unknown as TIssueOperations,
    isIntakeIssue: true,
  };
  const { rerender, container } = render(<IssueTitleInput {...props} />);
  expect(screen.getByRole("textbox")).toBeTruthy();
  expect(container.firstElementChild?.className).toContain("[&_textarea]:!text-[24px]");
  expect(container.firstElementChild?.className).toContain("[&_textarea]:!leading-[30px]");
  expect(container.firstElementChild?.className).toContain("[&_textarea]:!font-semibold");
  rerender(<IssueTitleInput {...props} disabled />);
  expect(screen.getByText("Intake title").className).toContain("text-[24px]");
  expect(container.textContent).toBe("Intake title");
});
