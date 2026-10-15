import {
  AttachOutline,
  CalendarOutline,
  CyclesOutline,
  DueDateOutline,
  EstimateOutline,
  LabelsOutline,
  LinkOutline,
  MembersOutline,
  ModuleOutline,
  PriorityOutline,
  StartDateOutline,
  StateOutline,
  WorkItemsOutline,
} from "@makeplane/propel/icons";
import type { TSpreadsheetPropertyIcon } from "@plane/constants";

const icons: Record<TSpreadsheetPropertyIcon, typeof StateOutline> = {
  AttachOutline,
  CalendarOutline,
  CyclesOutline,
  DueDateOutline,
  EstimateOutline,
  LabelsOutline,
  LinkOutline,
  MembersOutline,
  ModuleOutline,
  PriorityOutline,
  StartDateOutline,
  StateOutline,
  WorkItemsOutline,
};
export function SpreadsheetPropertyIcon({
  iconKey,
  className,
}: {
  iconKey: TSpreadsheetPropertyIcon;
  className?: string;
}) {
  const Glyph = icons[iconKey];
  return <Glyph className={className} />;
}
