/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link2, UserRound, Signal, CircleDashed, UsersRound, Folder } from "lucide-react";
import { FILTER_TYPE_OPTIONS } from "@plane/constants";
import type { TNotificationFilter } from "@plane/types";
import { useTranslation } from "@plane/i18n";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";

export type NotificationArrayFilter = "priority" | "state_group" | "assignees" | "triggered_by" | "project";
export function useNotificationFilterGroups() {
  const { t } = useTranslation();
  const {
    workspace: { workspaceMemberIds },
    getUserDetails,
  } = useMember();
  const { workspaceProjectIds, getProjectById } = useProject();
  const members = (workspaceMemberIds ?? []).map((id) => ({
    value: id,
    label: getUserDetails(id)?.display_name ?? id,
  }));
  return [
    {
      key: "type" as const,
      label: t("web.inbox_filters.relation"),
      icon: Link2,
      options: FILTER_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.i18n_label) })),
    },
    {
      key: "triggered_by" as const,
      label: t("web.inbox_filters.source"),
      icon: UserRound,
      options: members,
      searchable: true,
    },
    {
      key: "priority" as const,
      label: t("priority"),
      icon: Signal,
      options: ["urgent", "high", "medium", "low", "none"].map((value) => ({ value, label: t(value) })),
    },
    {
      key: "state_group" as const,
      label: t("web.inbox_filters.state_group"),
      icon: CircleDashed,
      options: ["backlog", "unstarted", "started", "completed", "cancelled"].map((value) => ({
        value,
        label: t(`web.inbox_filters.states.${value}`),
      })),
    },
    {
      key: "assignees" as const,
      label: t("web.inbox_filters.assignees"),
      icon: UsersRound,
      options: members,
      searchable: true,
    },
    {
      key: "project" as const,
      label: t("common.project"),
      icon: Folder,
      options: (workspaceProjectIds ?? []).map((id) => ({ value: id, label: getProjectById(id)?.name ?? id })),
      searchable: true,
    },
  ];
}
export function selectedNotificationFilterValues(filters: TNotificationFilter, key: "type" | NotificationArrayFilter) {
  return key === "type"
    ? Object.entries(filters.type)
        .filter(([, value]) => value)
        .map(([value]) => value)
    : (filters[key] ?? []);
}
