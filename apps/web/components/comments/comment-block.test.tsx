import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import type { TIssueComment } from "@plane/types";
import { CommentBlock } from "./comment-block";
it("omits the timeline for a single Intake message and uses the smaller card padding", () => {
  const { container } = render(
    <CommentBlock comment={{ id: "one" } as TIssueComment} ends="only" isIntakeIssue>
      <p>Message</p>
    </CommentBlock>
  );
  expect(container.querySelector(".w-px")).toBeNull();
  expect(container.querySelector(".rounded-xl")?.classList.contains("p-2.5")).toBe(true);
});
it("retains timeline and normal card style outside Intake", () => {
  const { container } = render(
    <CommentBlock comment={{ id: "one" } as TIssueComment} ends="top">
      <p>Message</p>
    </CommentBlock>
  );
  expect(container.querySelector(".w-px")).not.toBeNull();
  expect(container.querySelector(".p-3")).not.toBeNull();
});
