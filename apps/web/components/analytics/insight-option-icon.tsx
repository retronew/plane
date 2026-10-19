import {
  CalendarDays,
  CircleDashed,
  FolderKanban,
  Hash,
  Inbox,
  Layers,
  ListFilter,
  ListTodo,
  Tag,
  UserRound,
  Users,
  Flag,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Exact insight option values mapped to their icon. Null prototype keeps arbitrary keys from matching `Object.prototype`. */
const INSIGHT_OPTION_ICONS = Object.assign(Object.create(null) as Record<string, LucideIcon>, {
  projects: FolderKanban,
  PROJECTS: FolderKanban,
  users: Users,
  ASSIGNEES: UserRound,
  CREATED_BY: UserRound,
  ROLE: ShieldCheck,
  cycles: CircleDashed,
  CYCLES: CircleDashed,
  modules: Layers,
  MODULES: Layers,
  intake: Inbox,
  "work-items": ListTodo,
  PRIORITY: Flag,
  LABELS: Tag,
  STATES: CircleDashed,
  STATE_GROUPS: CircleDashed,
});

/** Icons used by both the selected value and its option, with a consistent glyph size. */
export function InsightOptionIcon({ value }: { value: string }) {
  const Icon =
    INSIGHT_OPTION_ICONS[value] ??
    (value.endsWith("DATE") || value.endsWith("AT") ? CalendarDays : value === "" ? ListFilter : Hash);
  return <Icon className="size-3.5 shrink-0 text-secondary" />;
}
