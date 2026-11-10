import type { SVGProps } from "react";

/** Original hosted Plane work-item/type glyph; the current Propel glyph uses a different 16px grid. */
export function WorkItemTypeGlyph(props: SVGProps<SVGSVGElement>) {
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
