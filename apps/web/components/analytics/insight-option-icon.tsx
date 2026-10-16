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

/** Icons used by both the selected value and its option, with a consistent glyph size. */
export function InsightOptionIcon({ value }: { value: string }) {
  const Icon =
    value === "projects" || value === "PROJECTS"
      ? FolderKanban
      : value === "users"
        ? Users
        : value === "ASSIGNEES" || value === "CREATED_BY"
          ? UserRound
          : value === "ROLE"
            ? ShieldCheck
            : value === "cycles" || value === "CYCLES"
              ? CircleDashed
              : value === "modules" || value === "MODULES"
                ? Layers
                : value === "intake"
                  ? Inbox
                  : value === "work-items"
                    ? ListTodo
                    : value === "PRIORITY"
                      ? Flag
                      : value === "LABELS"
                        ? Tag
                        : value === "STATES" || value === "STATE_GROUPS"
                          ? CircleDashed
                          : value.endsWith("DATE") || value.endsWith("AT")
                            ? CalendarDays
                            : value === ""
                              ? ListFilter
                              : Hash;
  return <Icon className="size-3.5 shrink-0 text-secondary" />;
}
