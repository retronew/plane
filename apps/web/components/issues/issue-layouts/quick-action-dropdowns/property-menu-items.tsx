/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import { Avatar } from "@makeplane/propel/components/avatar";
import {
  AssigneeOutline,
  CyclesOutline,
  DueDateOutline,
  ModuleOutline,
  PriorityOutline,
} from "@makeplane/propel/icons";
// plane imports
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { LabelPropertyIcon, PriorityIcon, StateGroupIcon } from "@plane/blocks/icons";
import { ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { ICycle, IIssueLabel, IModule, IState, IUserLite, TIssue, TIssuePriorities } from "@plane/types";
import { getFileURL, renderFormattedPayloadDate } from "@plane/utils";
// helpers
import { workflowAllowsTransition, workflowIsActive } from "@/helpers/workflow";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useUser } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";

export type TPropertyMenuItemsProps = {
  issue: TIssue;
  isEditingAllowed: boolean;
  /** Persists a partial update of the work item; the submenus are hidden without it. */
  onUpdate?: (data: Partial<TIssue>) => Promise<void> | void;
};

/** Cycle and module membership live behind their own endpoints, not the work item's PATCH. */
export type TPropertyMenuMembershipActions = {
  setCycle: (cycleId: string | null) => void;
  changeModules: (addModuleIds: string[], removeModuleIds: string[]) => void;
};

type TPropertyMenuSources = {
  states: IState[];
  members: IUserLite[];
  labels: IIssueLabel[];
  cycles: Pick<ICycle, "id" | "name">[];
  modules: Pick<IModule, "id" | "name">[];
  priorityTitles: { key: TIssuePriorities; title: string }[];
};

const PROPERTIES_SECTION = "properties";
const DAY_MS = 24 * 60 * 60 * 1000;

const toggle = (values: string[] | undefined, id: string) =>
  values?.includes(id) ? values.filter((value) => value !== id) : [...(values ?? []), id];

/** Today, tomorrow and a week out, like Linear's due-date shortcuts; labelled in the viewer's locale. */
const getDueDatePresets = (now: Date, locale: string | undefined, todayLabel: string) =>
  [0, 1, 7].map((offset) => {
    const date = new Date(now.getTime() + offset * DAY_MS);
    const formatted = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(
      date
    );
    return {
      key: `due-${offset}`,
      title: offset === 0 ? `${todayLabel} · ${formatted}` : formatted,
      value: renderFormattedPayloadDate(date) ?? null,
    };
  });

/**
 * Builds Linear-style property submenus — state, priority, assignees, labels, due date, cycle and
 * modules — so the common edits happen straight from the right-click menu. Single-value rows close
 * the menu on pick; multi-value rows (assignees, labels, modules) toggle in place and keep it open.
 * Long pick lists are `searchable`: hovering the row opens the list with a focused filter field.
 */
export function buildPropertyMenuItems(
  props: TPropertyMenuItemsProps & {
    t: (key: string) => string;
    sources: TPropertyMenuSources;
    membership?: TPropertyMenuMembershipActions;
    now?: Date;
    locale?: string;
  }
): TContextMenuItem[] {
  const { issue, isEditingAllowed, onUpdate, t, sources, membership, now = new Date(), locale } = props;
  const shouldRender = isEditingAllowed && !!onUpdate;
  const update = (data: Partial<TIssue>) => void onUpdate?.(data);
  const dueDatePresets = getDueDatePresets(now, locale, t("common.today"));

  return [
    {
      key: "state",
      section: PROPERTIES_SECTION,
      title: t("common.state"),
      customContent: <StateGroupIcon stateGroup="unstarted" />,
      action: () => {},
      searchable: true,
      searchPlaceholder: `${t("power_k.contextual_actions.work_item.change_state")}…`,
      shouldRender: shouldRender && sources.states.length > 0,
      nestedMenuItems: sources.states.map((state) => ({
        key: `state-${state.id}`,
        title: state.name,
        customContent: <StateGroupIcon stateGroup={state.group} color={state.color} />,
        selected: issue.state_id === state.id,
        action: () => {
          if (issue.state_id !== state.id) update({ state_id: state.id });
        },
      })),
    },
    {
      key: "priority",
      section: PROPERTIES_SECTION,
      title: t("common.priority"),
      icon: PriorityOutline,
      action: () => {},
      shouldRender,
      nestedMenuItems: sources.priorityTitles.map((priority) => ({
        key: `priority-${priority.key}`,
        title: priority.title,
        customContent: <PriorityIcon priority={priority.key} />,
        selected: (issue.priority ?? "none") === priority.key,
        action: () => {
          if (issue.priority !== priority.key) update({ priority: priority.key });
        },
      })),
    },
    {
      key: "assignees",
      section: PROPERTIES_SECTION,
      title: t("common.assignees"),
      icon: AssigneeOutline,
      action: () => {},
      searchable: true,
      searchPlaceholder: `${t("power_k.contextual_actions.work_item.change_assignees")}…`,
      shouldRender: shouldRender && sources.members.length > 0,
      nestedMenuItems: sources.members.map((member) => ({
        key: `assignee-${member.id}`,
        title: member.display_name,
        customContent: <Avatar alt={member.display_name} src={getFileURL(member.avatar_url ?? "") ?? ""} size="xs" />,
        checked: !!issue.assignee_ids?.includes(member.id),
        action: () => update({ assignee_ids: toggle(issue.assignee_ids, member.id) }),
      })),
    },
    {
      key: "labels",
      section: PROPERTIES_SECTION,
      title: t("common.labels"),
      customContent: <LabelPropertyIcon />,
      action: () => {},
      searchable: true,
      searchPlaceholder: `${t("power_k.contextual_actions.work_item.add_labels")}…`,
      shouldRender: shouldRender && sources.labels.length > 0,
      nestedMenuItems: sources.labels.map((label) => ({
        key: `label-${label.id}`,
        title: label.name,
        customContent: <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />,
        checked: !!issue.label_ids?.includes(label.id),
        action: () => update({ label_ids: toggle(issue.label_ids, label.id) }),
      })),
    },
    {
      key: "due-date",
      section: PROPERTIES_SECTION,
      title: t("common.order_by.due_date"),
      icon: DueDateOutline,
      action: () => {},
      shouldRender,
      nestedMenuItems: [
        ...dueDatePresets.map((preset) => ({
          key: preset.key,
          title: preset.title,
          action: () => update({ target_date: preset.value }),
        })),
        {
          key: "due-clear",
          title: t("common.clear"),
          action: () => update({ target_date: null }),
          shouldRender: !!issue.target_date,
        },
      ],
    },
    {
      key: "cycle",
      section: PROPERTIES_SECTION,
      title: t("common.cycle"),
      icon: CyclesOutline,
      action: () => {},
      searchable: true,
      searchPlaceholder: `${t("power_k.contextual_actions.work_item.add_to_cycle")}…`,
      shouldRender: shouldRender && !!membership && sources.cycles.length > 0,
      nestedMenuItems: [
        {
          key: "cycle-none",
          title: t("cycle.no_cycle"),
          selected: !issue.cycle_id,
          action: () => {
            if (issue.cycle_id) membership?.setCycle(null);
          },
        },
        ...sources.cycles.map((cycle) => ({
          key: `cycle-${cycle.id}`,
          title: cycle.name,
          selected: issue.cycle_id === cycle.id,
          action: () => {
            if (issue.cycle_id !== cycle.id) membership?.setCycle(cycle.id);
          },
        })),
      ],
    },
    {
      key: "modules",
      section: PROPERTIES_SECTION,
      title: t("common.modules"),
      icon: ModuleOutline,
      action: () => {},
      searchable: true,
      searchPlaceholder: `${t("power_k.contextual_actions.work_item.add_to_modules")}…`,
      shouldRender: shouldRender && !!membership && sources.modules.length > 0,
      nestedMenuItems: sources.modules.map((module) => {
        const isMember = !!issue.module_ids?.includes(module.id);
        return {
          key: `module-${module.id}`,
          title: module.name,
          checked: isMember,
          action: () =>
            isMember ? membership?.changeModules([], [module.id]) : membership?.changeModules([module.id], []),
        };
      }),
    },
  ];
}

/** Store-backed wrapper around {@link buildPropertyMenuItems}; call it from an observer component. */
export const usePropertyMenuItems = (props: TPropertyMenuItemsProps): TContextMenuItem[] => {
  const { issue } = props;
  const projectId = issue.project_id ?? undefined;
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { t, currentLocale } = useTranslation();
  const { getProjectStates } = useProjectState();
  const { getProjectLabels } = useLabel();
  const {
    getUserDetails,
    project: { getProjectMemberIds },
  } = useMember();
  const { getProjectCycleIds, getCycleById } = useCycle();
  const { getProjectModuleIds, getModuleById } = useModule();
  const storeType = useIssueStoreType();
  const {
    issues: { addCycleToIssue, removeCycleFromIssue, changeModulesInIssue },
  } = useIssues(storeType);
  const workflowStore = useProjectWorkflow(projectId);
  const { data: user } = useUser();
  // derived values
  const workflow = workflowStore.resolve(projectId ?? "", issue.type_id);
  // honour the project workflow the same way the state dropdown does; the API enforces it on save
  const states = (getProjectStates(projectId) ?? []).filter(
    (state) =>
      !workflowIsActive(workflow) ||
      state.id === issue.state_id ||
      !issue.state_id ||
      workflowAllowsTransition(workflow, issue.state_id, state.id, user?.id)
  );
  const members = (projectId ? (getProjectMemberIds(projectId, false) ?? []) : [])
    .map((memberId) => getUserDetails(memberId))
    .filter((member): member is IUserLite => !!member);
  const labels = getProjectLabels(projectId) ?? [];
  // only cycles a work item can still join: not completed and not archived
  const cycles = (projectId ? (getProjectCycleIds(projectId) ?? []) : [])
    .map((cycleId) => getCycleById(cycleId))
    .filter((cycle): cycle is ICycle => !!cycle && !cycle.archived_at && cycle.status?.toLowerCase() !== "completed");
  const modules = (projectId ? (getProjectModuleIds(projectId) ?? []) : [])
    .map((moduleId) => getModuleById(moduleId))
    .filter((module): module is IModule => !!module && !module.archived_at);
  const slug = workspaceSlug?.toString();
  const membership: TPropertyMenuMembershipActions | undefined =
    slug && projectId
      ? {
          setCycle: (cycleId) =>
            void (cycleId
              ? addCycleToIssue?.(slug, projectId, cycleId, issue.id)
              : removeCycleFromIssue?.(slug, projectId, issue.id)),
          changeModules: (addModuleIds, removeModuleIds) =>
            void changeModulesInIssue?.(slug, projectId, issue.id, addModuleIds, removeModuleIds),
        }
      : undefined;

  return buildPropertyMenuItems({
    ...props,
    t,
    membership,
    locale: currentLocale,
    sources: { states, members, labels, cycles, modules, priorityTitles: ISSUE_PRIORITIES },
  });
};
