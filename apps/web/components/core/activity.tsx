/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cloneElement, isValidElement, useEffect } from "react";
import { ActivitySentence } from "@/components/common/activity/activity-sentence";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// store hooks
// icons
import { TriangleIcon, SignalMediumIcon } from "lucide-react";
import {
  ArchiveOutline,
  AttachOutline,
  CalendarOutline,
  ChatOutline,
  CyclesOutline,
  DuplicateOfOutline,
  EpicOutline,
  GridOutline,
  IntakeOutline,
  LabelsOutline,
  LinkOutline,
  MembersOutline,
  ModuleOutline,
  RelatesToOutline,
  WorkItemsOutline,
} from "@makeplane/propel/icons";
import { BlockedIcon, BlockerIcon } from "@plane/blocks/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IIssueActivity, TIssueActivity } from "@plane/types";
import { renderFormattedDate, generateWorkItemLink } from "@plane/utils";
// helpers
import { useLabel } from "@/hooks/store/use-label";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { translate, Translation } from "@plane/i18n";
// types

export function IssueLink({ activity }: { activity: IIssueActivity | TIssueActivity }) {
  // router params
  const { workspaceSlug } = useParams();
  const { isMobile } = usePlatformOS();

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString() ?? activity.workspace_detail?.slug,
    projectId: activity?.project,
    issueId: activity?.issue,
    projectIdentifier: activity?.project_detail?.identifier,
    sequenceId: activity?.issue_detail?.sequence_id,
  });

  const isDeleted =
    activity.issue === null ||
    ((activity.field === "issue" || activity.field === "epic") && activity.verb === "deleted");
  if (isDeleted) {
    return (
      <Tooltip label={translate("web.this_work_item_has_been_deleted")} disabled={isMobile}>
        <span className="inline text-tertiary">
          {activity.issue_detail && (
            <span className="mr-1 whitespace-nowrap">{`${activity.project_detail.identifier}-${activity.issue_detail.sequence_id}`}</span>
          )}
          <del className="break-words line-through">{activity.issue_detail?.name ?? translate("web.a_work_item")}</del>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      label={activity?.issue_detail ? activity.issue_detail.name : translate("web.this_work_item_has_been_deleted")}
      layout="stacked"
      disabled={isMobile}
    >
      {activity?.issue_detail ? (
        <a
          aria-disabled={activity.issue === null}
          href={workItemLink}
          target={activity.issue === null ? "_self" : "_blank"}
          rel={activity.issue === null ? "" : "noopener noreferrer"}
          className="inline items-center gap-1 font-medium text-primary hover:underline"
        >
          <span className="whitespace-nowrap">{`${activity.project_detail.identifier}-${activity.issue_detail.sequence_id}`}</span>{" "}
          <span className="font-regular break-all">{activity.issue_detail?.name}</span>
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-primary">
          {translate("web.a_work_item")}{" "}
        </span>
      )}
    </Tooltip>
  );
}

function UserLink({ activity }: { activity: IIssueActivity | TIssueActivity }) {
  // router params
  const { workspaceSlug } = useParams();

  return (
    <a
      href={`/${workspaceSlug ?? activity.workspace_detail?.slug}/profile/${
        activity.new_identifier ?? activity.old_identifier
      }`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center font-medium text-primary hover:underline"
    >
      {activity.new_value && activity.new_value !== "" ? activity.new_value : activity.old_value}
    </a>
  );
}

const LabelPill = observer(function LabelPill({ labelId, workspaceSlug }: { labelId: string; workspaceSlug: string }) {
  // store hooks
  const { workspaceLabels, fetchWorkspaceLabels } = useLabel();

  useEffect(() => {
    if (!workspaceLabels) fetchWorkspaceLabels(workspaceSlug);
  }, [fetchWorkspaceLabels, workspaceLabels, workspaceSlug]);

  const color = workspaceLabels?.find((label) => label.id === labelId)?.color?.trim();
  if (!color) return null;

  return (
    <span
      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
      style={{
        backgroundColor: color,
      }}
      aria-hidden="true"
    />
  );
});

function activityMessage(
  key: string,
  activity: IIssueActivity | TIssueActivity,
  showIssue: boolean,
  value?: React.ReactNode
) {
  return (
    <Translation
      translationKey={`web.activity.${key}`}
      components={{
        issue: showIssue ? (
          <span data-activity-part="">
            <IssueLink activity={activity} />
          </span>
        ) : (
          <Translation translationKey="web.this_work_item" />
        ),
        value: value == null ? value : <span data-activity-part="">{value}</span>,
      }}
    />
  );
}

function activityValue(value: React.ReactNode) {
  return <span className="font-medium break-all text-primary">{value}</span>;
}

function activityContainerLink(
  activity: IIssueActivity | TIssueActivity,
  workspaceSlug: string,
  kind: "cycles" | "modules"
) {
  const removed = activity.verb !== "created" && activity.verb !== "updated";
  return (
    <a
      href={`/${workspaceSlug}/projects/${activity.project}/${kind}/${removed ? activity.old_identifier : activity.new_identifier}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline items-center gap-1 font-medium text-primary hover:underline"
    >
      {removed ? activity.old_value : activity.new_value}
    </a>
  );
}

const activityDetails: Record<
  string,
  {
    message: (activity: IIssueActivity | TIssueActivity, showIssue: boolean, workspaceSlug: string) => React.ReactNode;
    icon: React.ReactNode;
  }
> = {
  assignees: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.old_value === "" ? "assignee_added" : "assignee_removed",
        activity,
        showIssue,
        <UserLink activity={activity} />
      ),
    icon: <MembersOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  archived_at: {
    message: (activity) => activityMessage(activity.new_value === "restore" ? "restored" : "archived", activity, true),
    icon: <ArchiveOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  attachment: {
    message: (activity, showIssue) =>
      activityMessage(activity.verb === "created" ? "attachment_added" : "attachment_removed", activity, showIssue),
    icon: <AttachOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  description: {
    message: (activity, showIssue) => activityMessage("description", activity, showIssue),
    icon: <ChatOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  estimate_point: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.new_value ? "estimate_set" : "estimate_removed",
        activity,
        showIssue,
        activityValue(activity.new_value)
      ),
    icon: <TriangleIcon size={12} className="text-secondary" aria-hidden="true" />,
  },
  issue: {
    message: (activity) =>
      activityMessage(
        activity.verb === "created" ? "created" : activity.verb === "converted" ? "converted_epic" : "deleted",
        activity,
        true
      ),
    icon: <WorkItemsOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  epic: {
    message: (activity) =>
      activityMessage(
        activity.verb === "created" ? "created" : activity.verb === "converted" ? "converted_issue" : "deleted",
        activity,
        true
      ),
    icon: <EpicOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  labels: {
    message: (activity, showIssue, workspaceSlug) =>
      activityMessage(
        activity.old_value === "" ? "label_added" : "label_removed",
        activity,
        showIssue,
        <span className="inline-flex items-center gap-1 rounded-full border border-subtle-1 px-1.5 text-11 leading-4">
          <LabelPill
            labelId={(activity.old_value === "" ? activity.new_identifier : activity.old_identifier) ?? ""}
            workspaceSlug={workspaceSlug}
          />
          {activityValue(activity.old_value === "" ? activity.new_value : activity.old_value)}
        </span>
      ),
    icon: <LabelsOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  link: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.verb === "created" ? "link_added" : activity.verb === "updated" ? "link_updated" : "link_removed",
        activity,
        showIssue,
        <a
          href={(activity.verb === "created" ? activity.new_value : activity.old_value) ?? ""}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <Translation translationKey="web.ui.link" />
        </a>
      ),
    icon: <LinkOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  name: {
    message: (activity, showIssue) => activityMessage("name", activity, showIssue, activityValue(activity.new_value)),
    icon: <ChatOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  parent: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.new_value ? "parent_set" : "parent_removed",
        activity,
        showIssue,
        activityValue(activity.new_value || activity.old_value)
      ),
    icon: <MembersOutline className="h-3 w-3 !text-secondary" aria-hidden="true" />,
  },
  priority: {
    message: (activity, showIssue) =>
      activityMessage(
        "priority",
        activity,
        showIssue,
        activityValue(<Translation translationKey={activity.new_value || "none"} />)
      ),
    icon: <SignalMediumIcon size={12} className="text-secondary" aria-hidden="true" />,
  },
  state: {
    message: (activity, showIssue) => activityMessage("state", activity, showIssue, activityValue(activity.new_value)),
    icon: <GridOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  inbox: {
    message: (activity, showIssue) =>
      activityMessage(
        (
          { "-1": "intake_declined", "0": "intake_snoozed", "1": "intake_accepted", "2": "intake_duplicate" } as Record<
            string,
            string
          >
        )[activity.verb] ?? "intake_updated",
        activity,
        showIssue
      ),
    icon: <IntakeOutline className="size-3 text-secondary" aria-hidden="true" />,
  },
  cycles: {
    message: (activity, showIssue, workspaceSlug) =>
      activityMessage(
        activity.verb === "created" ? "cycle_added" : activity.verb === "updated" ? "cycle_set" : "cycle_removed",
        activity,
        showIssue,
        activityContainerLink(activity, workspaceSlug, "cycles")
      ),
    icon: <CyclesOutline height={12} width={12} className="text-secondary" aria-hidden="true" />,
  },
  modules: {
    message: (activity, showIssue, workspaceSlug) =>
      activityMessage(
        activity.verb === "created" ? "module_added" : activity.verb === "updated" ? "module_set" : "module_removed",
        activity,
        showIssue,
        activityContainerLink(activity, workspaceSlug, "modules")
      ),
    icon: <ModuleOutline className="h-3 w-3 !text-secondary" aria-hidden="true" />,
  },
  relates_to: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.old_value === "" ? "related_added" : "related_removed",
        activity,
        showIssue,
        activityValue(activity.old_value === "" ? activity.new_value : activity.old_value)
      ),
    icon: <RelatesToOutline height="12" width="12" className="text-secondary" />,
  },
  blocking: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.old_value === "" ? "blocking_added" : "blocking_removed",
        activity,
        showIssue,
        activityValue(activity.old_value === "" ? activity.new_value : activity.old_value)
      ),
    icon: <BlockerIcon height="12" width="12" className="text-secondary" />,
  },
  blocked_by: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.old_value === "" ? "blocked_added" : "blocked_removed",
        activity,
        showIssue,
        activityValue(activity.old_value === "" ? activity.new_value : activity.old_value)
      ),
    icon: <BlockedIcon height="12" width="12" className="text-secondary" />,
  },
  duplicate: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.old_value === "" ? "duplicate_added" : "duplicate_removed",
        activity,
        showIssue,
        activityValue(activity.old_value === "" ? activity.new_value : activity.old_value)
      ),
    icon: <DuplicateOfOutline width={12} height={12} className="text-secondary" />,
  },
  start_date: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.new_value ? "start_date_set" : "start_date_removed",
        activity,
        showIssue,
        activityValue(activity.new_value ? renderFormattedDate(activity.new_value) : "")
      ),
    icon: <CalendarOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
  target_date: {
    message: (activity, showIssue) =>
      activityMessage(
        activity.new_value ? "due_date_set" : "due_date_removed",
        activity,
        showIssue,
        activityValue(activity.new_value ? renderFormattedDate(activity.new_value) : "")
      ),
    icon: <CalendarOutline width={12} height={12} className="text-secondary" aria-hidden="true" />,
  },
};

export function ActivityIcon({ activity, size = 12 }: { activity: IIssueActivity | TIssueActivity; size?: number }) {
  const icon = activityDetails[activity.field as keyof typeof activityDetails]?.icon;
  return isValidElement<{ width?: number; height?: number; size?: number }>(icon)
    ? cloneElement(icon, { width: size, height: size, size })
    : null;
}

type ActivityMessageProps = {
  activity: IIssueActivity | TIssueActivity;
  showIssue?: boolean;
};

export function ActivityMessage({ activity, showIssue = false }: ActivityMessageProps) {
  // router params
  const { workspaceSlug } = useParams();
  const activityField = activity.field ?? "issue";

  return (
    <ActivitySentence>
      {activityDetails[activityField as keyof typeof activityDetails]?.message(
        activity,
        showIssue,
        workspaceSlug ? workspaceSlug.toString() : (activity.workspace_detail?.slug ?? "")
      )}
    </ActivitySentence>
  );
}
