import type { SVGProps } from "react";

// The history timeline uses the original 24px glyphs from the hosted workflow UI.
// Propel's current FileStackOutline has a different shape (stacked documents).
export function WorkflowHistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18C3 19.6569 4.34315 21 6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15C4.34315 15 3 16.3431 3 18Z" />
        <path d="M15 6C15 7.65685 16.3431 9 18 9C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6Z" />
        <path d="M18 13V16C18 16.5304 17.7893 17.0391 17.4142 17.4142C17.0391 17.7893 16.5304 18 16 18H9M15 6H3" />
      </g>
    </svg>
  );
}

export { WorkItemTypeGlyph as WorkflowCreationHistoryIcon } from "@/components/issues/work-item-type-glyph";
