import {
  AlignLeft,
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ListOrdered,
  ListTree,
  LayoutList,
  AtSign,
  CalendarDays,
  CircleDashed,
  Columns3,
  Flag,
  FolderKanban,
  History,
  Layers,
  ListFilter,
  ListTodo,
  MessageSquare,
  ShieldCheck,
  Star,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  access: ShieldCheck,
  priority: Flag,
  state: CircleDashed,
  status: CircleDashed,
  state_group: CircleDashed,
  label: Tag,
  labels: Tag,
  lead: UserRound,
  assignee: UserRound,
  members: Users,
  member: Users,
  created_by: UserRound,
  mention: AtSign,
  mentions: AtSign,
  subscriber: Users,
  project: FolderKanban,
  cycle: CircleDashed,
  module: Layers,
  favorites: Star,
  created_at: CalendarDays,
  updated_at: History,
  start_date: CalendarDays,
  end_date: CalendarDays,
  due_date: CalendarDays,
  target_date: CalendarDays,
  date: CalendarDays,
  group_by: Layers,
  sub_group_by: Layers,
  order_by: ListOrdered,
  sort_direction: ArrowDownUp,
  asc: ArrowUpNarrowWide,
  desc: ArrowDownWideNarrow,
  sub_issue: ListTree,
  show_empty_groups: LayoutList,
  display_properties: Columns3,
  name: AlignLeft,
  description: AlignLeft,
  text: AlignLeft,
  activity: History,
  comment: MessageSquare,
  issue: ListTodo,
  page: AlignLeft,
  workspace_page: AlignLeft,
};

/** Shared semantic glyphs for filter fields, independent of translated labels. */
export function FilterFieldIcon({
  field,
  className = "size-3.5 shrink-0 text-icon-tertiary",
}: {
  field: string;
  className?: string;
}) {
  const key = field.toLowerCase().replaceAll("-", "_").replace(/_id$/, "");
  const Icon = icons[key] ?? ListFilter;
  return <Icon className={className} aria-hidden="true" />;
}
