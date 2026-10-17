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

export function WorkflowCreationHistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="M16.5953 6.69606L16.6072 5.17376L6.85812 8.92381V19.4238L9.00319 18.6961" />
        <path d="M12.0953 3.69606L12.1072 2.17376L2.35812 5.92381V16.4238L4.50319 15.6961" />
        <path d="M21.7438 17.9461L21.7511 7.44434L12.0021 11.1944V21.6944L21.7438 17.9461Z" />
      </g>
    </svg>
  );
}
