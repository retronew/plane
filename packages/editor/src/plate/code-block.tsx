import { PlateElement, type PlateElementProps } from "platejs/react";
// oxlint-disable-next-line import/no-unassigned-import -- Scoped upstream highlight.js themes.
import "./code-theme.css";

export function ComparisonCodeBlock(props: PlateElementProps) {
  const language = typeof props.element.lang === "string" ? props.element.lang : "plaintext";
  return (
    <PlateElement {...props} as="pre" className="plate-github-code">
      <code className={`language-${language}`}>{props.children}</code>
    </PlateElement>
  );
}
