/** One spacing contract for workspace project states and project work-item states. */
export const STATE_ROW_CLASS_NAME =
  "group relative flex min-h-14 items-center rounded-md px-2 py-2.5 focus-within:bg-layer-2-hover hover:bg-layer-2-hover";

/** Draw between siblings without adding height or leaving a line below a group's last state. */
export const STATE_ROW_DIVIDER_CLASS_NAME =
  "relative after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:border-b after:border-subtle after:opacity-50 last:after:hidden";
