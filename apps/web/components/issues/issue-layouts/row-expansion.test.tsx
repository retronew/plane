import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { IssueRowExpansionProvider, useIssueRowExpansion } from "./row-expansion";
function Row({ id }: { id: string }) {
  const [expanded, setExpanded] = useIssueRowExpansion(id);
  return (
    <button onClick={() => setExpanded((value) => !value)}>
      {id} {expanded ? "expanded" : "collapsed"}
    </button>
  );
}
it("preserves expanded children after a virtual row unmounts and keeps other rows independent", () => {
  const draw = (visible: boolean) => (
    <IssueRowExpansionProvider>
      {visible && <Row id="parent" />}
      <Row id="other" />
    </IssueRowExpansionProvider>
  );
  const { rerender } = render(draw(true));
  fireEvent.click(screen.getByText("parent collapsed"));
  rerender(draw(false));
  rerender(draw(true));
  expect(screen.getByText("parent expanded")).toBeTruthy();
  expect(screen.getByText("other collapsed")).toBeTruthy();
  fireEvent.click(screen.getByText("parent expanded"));
  expect(screen.getByText("parent collapsed")).toBeTruthy();
});
