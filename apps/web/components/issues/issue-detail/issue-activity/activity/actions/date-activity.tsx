import { observer } from "mobx-react";
import { CalendarOutline } from "@makeplane/propel/icons";
// plane imports
import { translate } from "@plane/i18n";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueActivityBlockComponent, IssueLink } from "./";

type Props = {
  activityId: string;
  showIssue?: boolean;
  ends: "top" | "bottom" | undefined;
  /** Copy shown when the date was set. */
  setLabelKey: Parameters<typeof translate>[0];
  /** Copy shown when the date was removed. */
  removedLabelKey: Parameters<typeof translate>[0];
};

/** Activity row for a date property, shared by the start-date and target-date actions. */
export const IssueDateActivity = observer(function IssueDateActivity({
  activityId,
  showIssue = true,
  ends,
  setLabelKey,
  removedLabelKey,
}: Props) {
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  return (
    <IssueActivityBlockComponent
      icon={<CalendarOutline width={14} height={14} className="text-secondary" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      <>
        {activity.new_value ? translate(setLabelKey) : translate(removedLabelKey)}
        {activity.new_value && (
          <>
            <span data-activity-part="" className="font-medium text-primary">
              {renderFormattedDate(activity.new_value)}
            </span>
          </>
        )}
        {showIssue && (activity.new_value ? ` for ` : ` from `)}
        {showIssue && <IssueLink activityId={activityId} />}.
      </>
    </IssueActivityBlockComponent>
  );
});
