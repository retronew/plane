/** One spacing contract for workspace project states and project work-item states. */
export const STATE_ROW_CLASS_NAME =
  "group relative flex min-h-14 items-center rounded-md px-2 py-2.5 focus-within:bg-layer-2-hover hover:bg-layer-2-hover";

/** Draw between siblings without adding height or leaving a line below a group's last state. */
export const STATE_ROW_DIVIDER_CLASS_NAME =
  "relative after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:border-b after:border-subtle after:opacity-50 last:after:hidden";

/**
 * Column for the "allow new work items" switch. Fixed at every width so the group heading's
 * switch and every state row's switch share one vertical line, and the trailing action
 * (the group's add button, a state's actions menu) sits the same distance past it.
 * `max-md:w-auto` gives the column back on a phone, where a fixed slot would eat the state name.
 */
export const STATE_SWITCH_SLOT_CLASS_NAME = "flex w-12 shrink-0 items-center justify-center max-md:w-auto";
