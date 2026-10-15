/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FC, ReactNode } from "react";
import {
  AlignLeftOutline,
  ArchiveOutline,
  AttachOutline,
  ClockOutline,
  CyclesOutline,
  DocumentationOutline,
  DueDateOutline,
  EstimateOutline,
  GitBranchOutline,
  GlobeOutline,
  GridOutline,
  HashOutline,
  HierarchyOutline,
  InboxOutline,
  IntakeOutline,
  LabelsOutline,
  LinkOutline,
  MembersOutline,
  ModuleOutline,
  PriorityOutline,
  RefreshOutline,
  StartDateOutline,
  StateOutline,
  SubscribeOutline,
  TextOutline,
  TimeTrackingOutline,
  ToDoOutline,
  WorkItemsOutline,
} from "@makeplane/propel/icons";
// components

import { store } from "@/lib/store-context";
import type { TProjectActivity } from "@plane/types";
import { translate, Translation } from "@plane/i18n";

type ActivityIconMap = {
  [key: string]: FC<{ className?: string }>;
};
export const iconsMap: ActivityIconMap = {
  priority: PriorityOutline,
  archived_at: ArchiveOutline,
  restored: RefreshOutline,
  link: LinkOutline,
  start_date: StartDateOutline,
  target_date: DueDateOutline,
  label: LabelsOutline,
  inbox: InboxOutline,
  description: AlignLeftOutline,
  assignee: MembersOutline,
  attachment: AttachOutline,
  name: TextOutline,
  state: StateOutline,
  estimate: EstimateOutline,
  cycle: CyclesOutline,
  module: ModuleOutline,
  page: DocumentationOutline,
  network: GlobeOutline,
  identifier: HashOutline,
  timezone: ClockOutline,
  is_project_updates_enabled: SubscribeOutline,
  is_epic_enabled: GridOutline,
  is_workflow_enabled: GitBranchOutline,
  is_time_tracking_enabled: TimeTrackingOutline,
  is_issue_type_enabled: ToDoOutline,
  default: HierarchyOutline,
  module_view: ModuleOutline,
  cycle_view: CyclesOutline,
  issue_views_view: WorkItemsOutline,
  page_view: DocumentationOutline,
  intake_view: IntakeOutline,
};

function projectMessage(key: string, value?: ReactNode) {
  return (
    <Translation
      translationKey={`web.project_activity.${key}`}
      components={{
        value: (
          <span data-activity-part="" className="font-medium text-primary">
            {value}
          </span>
        ),
      }}
    />
  );
}

export const messages = (activity: TProjectActivity): { message: string | ReactNode; customUserName?: string } => {
  const { field, new_value: newValue, old_value: oldValue, verb } = activity;
  const workspaceDetail = store.workspaceRoot.getWorkspaceById(activity.workspace);
  const value = newValue || oldValue;
  switch (field) {
    case "archived_at":
      return {
        message: projectMessage(newValue === "restore" ? "restored" : "archived"),
        customUserName: newValue === "archive" ? "Plane" : undefined,
      };
    case "priority":
      return { message: projectMessage("priority", <Translation translationKey={newValue || "none"} />) };
    case "name":
      return { message: projectMessage("name", newValue) };
    case "description":
      return { message: projectMessage(newValue ? "description_set" : "description_removed") };
    case "start_date":
    case "target_date":
      return { message: projectMessage(`${field}_${newValue ? "set" : "removed"}`, newValue) };
    case "state":
      return { message: projectMessage("state", newValue || <Translation translationKey="none" />) };
    case "estimate":
      return { message: projectMessage(newValue ? "estimate_set" : "estimate_removed", value) };
    case "cycles":
    case "modules": {
      const removed = verb === "removed";
      const name =
        (removed ? oldValue : newValue) || translate(field === "cycles" ? "web.unknown_cycle" : "web.unknown_module");
      const linkedName = removed ? (
        name
      ) : (
        <a
          href={`/${workspaceDetail?.slug}/projects/${activity.project}/${field}/${activity.new_identifier}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex font-medium text-primary"
        >
          {name}
        </a>
      );
      return { message: projectMessage(`${field}_${removed ? "removed" : "added"}`, linkedName) };
    }
    case "labels":
      return {
        message: projectMessage(
          verb === "removed" ? "label_removed" : "label_added",
          value || translate("web.untitled_label")
        ),
      };
    case "page":
      return {
        message: projectMessage(newValue ? "page_created" : "page_removed", value || translate("web.untitled_page")),
      };
    case "identifier":
      return { message: projectMessage("identifier", newValue || <Translation translationKey="none" />) };
    case "timezone":
      return { message: projectMessage("timezone", newValue || <Translation translationKey="web.ui.default" />) };
    default: {
      const features: Record<string, string> = {
        inbox: "inbox",
        network: "network",
        module_view: "module_view",
        cycle_view: "cycle_view",
        issue_views_view: "work_item_view",
        page_view: "page_view",
        intake_view: "intake_view",
        is_project_updates_enabled: "project_updates",
        is_epic_enabled: "epics",
        is_workflow_enabled: "workflow",
        is_time_tracking_enabled: "time_tracking",
        is_issue_type_enabled: "work_item_types",
      };
      const feature = field ? features[field] : undefined;
      if (!feature) return { message: projectMessage("updated") };
      const enabled = field === "inbox" || field === "network" ? Boolean(newValue) : newValue === "true";
      return {
        message: (
          <Translation
            translationKey={enabled ? "web.project_activity.enabled" : "web.project_activity.disabled"}
            components={{ feature: <Translation translationKey={`web.project_activity.features.${feature}`} /> }}
          />
        ),
      };
    }
  }
};
