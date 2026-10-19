import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { observer } from "mobx-react";
import { Link } from "react-router";
import {
  AlignLeftOutline,
  CloseOutline,
  DeleteOutline,
  EditOutline,
  FileStackOutline,
  HistoryOutline,
  MigrateOutline,
  TickCircleOutline,
  TextOutline,
} from "@makeplane/propel/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import {
  Drawer,
  DrawerPanel,
  DrawerHeader,
  DrawerHeaderContent,
  DrawerHeaderActions,
  DrawerTitle,
  DrawerBody,
} from "@makeplane/propel/components/drawer";
import { E_SORT_ORDER } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TWorkflowActivity, TWorkflowHistoryPage } from "@plane/types";
import { calculateTimeAgo, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import styles from "./history.module.css";
import { WorkflowCreationHistoryIcon, WorkflowHistoryIcon } from "./history-icons";
import { ActivitySortRoot } from "@/components/issues/issue-detail/issue-activity/sort-root";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { memberSnapshotChanges } from "./history-changes";

const snapshotLabels: Record<string, string> = {
  name: "web.workflow_ui.history_fields.name",
  description: "web.workflow_ui.history_fields.description",
  state: "web.workflow_ui.history_fields.state",
  state_ids: "web.workflow_ui.history_fields.states",
  enabled: "web.workflow_ui.history_fields.enabled",
  is_active: "web.workflow_ui.history_fields.is_active",
  operation: "web.workflow_ui.history_fields.operation",
  affected_count: "web.workflow_ui.history_fields.affected_count",
  state_mapping: "web.workflow_ui.history_fields.state_mapping",
  allow_creation: "web.workflow_ui.history_fields.allow_creation",
};

export function HistorySnapshot({ entry }: { entry: TWorkflowActivity }) {
  const { t } = useTranslation();
  const { before, after, schema_version } = entry.data;
  if (schema_version !== 2 || (!before && !after)) return null;
  const isRule = entry.action.startsWith("transition_");
  const changes = isRule ? memberSnapshotChanges(before, after) : undefined;
  const renderValue = (value: unknown): string => {
    if (typeof value === "boolean")
      return t(value ? "web.workflow_ui.enabled_value" : "web.workflow_ui.disabled_value");
    if (value === null) return t("web.workflow_ui.project_default");
    if (typeof value === "object" && value && "name" in value && typeof value.name === "string") return value.name;
    if (Array.isArray(value)) return value.map(renderValue).join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value ?? "—") || "—";
  };
  return (
    <div className="mt-1 space-y-1 rounded bg-layer-1 p-2 text-caption-sm-regular break-words text-secondary">
      {([before, after] as const).map(
        (snapshot, index) =>
          snapshot && (
            <p key={snapshot === before ? "before" : "after"}>
              {t(index ? "web.workflow_ui.after" : "web.workflow_ui.before")}
              {": "}
              {isRule ? (
                <>
                  {[
                    snapshot.source?.name ?? snapshot.source_name,
                    snapshot.destination?.name ?? snapshot.destination_name,
                  ]
                    .filter(Boolean)
                    .join(" → ")}
                  {" · "}
                  {snapshot.member_mode === "all"
                    ? t("web.workflow_ui.all_members")
                    : snapshot.members?.map((member) => member.name).join(", ") ||
                      t("web.workflow_ui.snapshot_missing")}
                </>
              ) : (
                Object.entries(snapshot)
                  .map(
                    ([field, value]) =>
                      `${snapshotLabels[field] ? t(snapshotLabels[field]) : field}: ${renderValue(value)}`
                  )
                  .join(" · ")
              )}
              {isRule && snapshot.kind === "approval" && (
                <span>
                  {" · "}
                  {t("web.workflow_ui.approvers")}
                  {": "}
                  {snapshot.approver_mode === "all"
                    ? t("web.workflow_ui.all_members")
                    : snapshot.approvers?.map((member) => member.name).join(", ") ||
                      t("web.workflow_ui.snapshot_missing")}
                </span>
              )}
            </p>
          )
      )}
      {!!changes?.added.length && (
        <p>{t("web.workflow_ui.members_added", { members: changes.added.map((member) => member.name).join(", ") })}</p>
      )}
      {!!changes?.removed.length && (
        <p>
          {t("web.workflow_ui.members_removed", { members: changes.removed.map((member) => member.name).join(", ") })}
        </p>
      )}
    </div>
  );
}

function getHistoryIcon(entry: TWorkflowActivity) {
  if (entry.action.startsWith("transition_")) return WorkflowHistoryIcon;
  switch (entry.action) {
    case "created":
      return FileStackOutline;
    case "creation":
      return WorkflowCreationHistoryIcon;
    case "initial":
      return TickCircleOutline;
    case "enabled":
    case "is_active":
      return WorkflowHistoryIcon;
    case "name":
      return TextOutline;
    case "description":
      return AlignLeftOutline;
    case "updated":
      return EditOutline;
    case "deleted":
      return DeleteOutline;
    case "migration":
      return MigrateOutline;
    default:
      return HistoryOutline;
  }
}

export const WorkflowHistory = observer(function WorkflowHistory({
  open,
  onClose,
  projectId,
  workspaceSlug,
  workflowId = "default",
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceSlug: string;
  workflowId?: string;
}) {
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const revision = store.historyRevision[projectId] ?? 0;
  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite<TWorkflowHistoryPage>(
    (index, previous: TWorkflowHistoryPage | null) =>
      !open || (previous && previous.next_offset === null && !previous.next_cursor)
        ? null
        : [
            "workflow-history",
            workspaceSlug,
            projectId,
            workflowId,
            direction,
            revision,
            index === 0 ? 0 : (previous?.next_offset ?? 0),
            index === 0 ? "" : (previous?.next_cursor ?? ""),
            index === 0 ? "" : (previous?.watermark ?? ""),
          ],
    ([, slug, project, workflow, order, , offset, cursor, watermark]: [
      string,
      string,
      string,
      string,
      "asc" | "desc",
      number,
      number,
      string,
      string,
    ]) =>
      store.service.history(slug, project, offset, {
        workflowId: workflow,
        direction: order,
        cursor: cursor || undefined,
        watermark: watermark || undefined,
      }),
    { revalidateFirstPage: false, persistSize: false }
  );
  // A null SWR key stops closed-panel requests but clears its data immediately.
  // Retain the final open frame until Base UI finishes the closing transition.
  const [retainedData, setRetainedData] = useState(data);
  if (open && retainedData !== data) setRetainedData(data);
  const visibleData = open ? data : retainedData;
  const entries = [
    ...new Map((visibleData ?? []).flatMap((page) => page.results).map((entry) => [entry.id, entry])).values(),
  ];
  const last = visibleData?.at(-1);
  return (
    <Drawer
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      swipeDirection="right"
    >
      <DrawerPanel side="end" size="sm" variant="inline" data-workflow-history="">
        <DrawerHeader data-workflow-history-header="">
          <DrawerHeaderContent>
            <DrawerTitle data-workflow-history-title="">{t("common.change_history")}</DrawerTitle>
          </DrawerHeaderContent>
          <DrawerHeaderActions side="end" data-workflow-history-actions="">
            <ActivitySortRoot
              sortOrder={direction === "asc" ? E_SORT_ORDER.ASC : E_SORT_ORDER.DESC}
              toggleSort={() => setDirection((value) => (value === "asc" ? "desc" : "asc"))}
            />
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t("close")}
              icon={<CloseOutline className="size-3.5" />}
              onClick={onClose}
            />
          </DrawerHeaderActions>
        </DrawerHeader>
        <DrawerBody data-workflow-history-body="">
          <div>
            <ol className="m-0 list-none p-0">
              {entries.map((entry) => {
                const Icon = getHistoryIcon(entry);
                return (
                  <li
                    key={entry.id}
                    className={`relative flex items-start gap-2 text-caption-sm-regular text-secondary ${styles.activity}`}
                  >
                    {entries.length > 1 && (
                      <span aria-hidden="true" className={`absolute left-[13px] w-px bg-layer-3 ${styles.connector}`} />
                    )}
                    <div
                      aria-hidden="true"
                      className="z-[4] mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-subtle bg-layer-2 text-secondary shadow-raised-100"
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 break-words">
                      <p className="line-clamp-2">
                        {entry.actor_id ? (
                          <Link
                            className="mr-1 font-medium text-primary hover:underline"
                            to={`/${workspaceSlug}/profile/${entry.actor_id}/`}
                          >
                            {entry.actor_name}
                          </Link>
                        ) : (
                          <span className="mr-1 font-medium text-primary">{entry.actor_name}</span>
                        )}
                        {t(`web.workflow_ui.history.${entry.action}`, {
                          state: entry.data.state_name || t("web.workflow_ui.project_default"),
                          source: entry.data.source_name ?? "",
                          destination: entry.data.destination_name ?? "",
                          value: t(
                            entry.data.value ? "web.workflow_ui.enabled_value" : "web.workflow_ui.disabled_value"
                          ),
                        })}
                      </p>
                      <HistorySnapshot entry={entry} />
                      <Tooltip
                        label={`${renderFormattedDate(entry.created_at)}, ${renderFormattedTime(entry.created_at)}`}
                      >
                        <time
                          className="mt-1 block w-fit cursor-help text-caption-sm-regular font-medium text-tertiary"
                          dateTime={entry.created_at}
                        >
                          {calculateTimeAgo(entry.created_at)}
                        </time>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ol>
            {!isValidating && !entries.length && !error && (
              <p className="text-body-xs-regular text-tertiary">{t("web.workflow_ui.no_history")}</p>
            )}
            {error && (
              <Button
                stretch="auto"
                size="md"
                variant="ghost"
                onClick={() => void mutate()}
                label={t("common.retry")}
              />
            )}
            {isValidating ? (
              <output className="text-body-xs-regular text-tertiary">{t("loading")}</output>
            ) : (
              (last?.next_cursor || last?.next_offset != null) &&
              !error && (
                <Button
                  stretch="auto"
                  size="md"
                  variant="ghost"
                  onClick={() => void setSize(size + 1)}
                  label={t("load_more")}
                />
              )
            )}
          </div>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
});
