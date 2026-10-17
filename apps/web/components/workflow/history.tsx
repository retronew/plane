import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { observer } from "mobx-react";
import { Link } from "react-router";
import { History, X } from "lucide-react";
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
import type { TWorkflowActivity, TWorkflowHistoryPage, TWorkflowRuleSnapshot } from "@plane/types";
import { ActivitySortRoot } from "@/components/issues/issue-detail/issue-activity/sort-root";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";

export function memberSnapshotChanges(before?: TWorkflowRuleSnapshot | null, after?: TWorkflowRuleSnapshot | null) {
  if (!before?.members || !after?.members) return undefined;
  return {
    added: after.members.filter((member) => !before.members!.some((old) => old.id === member.id)),
    removed: before.members.filter((member) => !after.members!.some((next) => next.id === member.id)),
  };
}

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
  if (schema_version !== 2 || (!before && !after))
    return <p className="text-caption-md-regular text-tertiary">{t("web.workflow_ui.snapshot_missing")}</p>;
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
    <div className="space-y-1 rounded bg-layer-1 p-2 text-caption-md-regular text-secondary">
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
  const entries = [...new Map((data ?? []).flatMap((page) => page.results).map((entry) => [entry.id, entry])).values()];
  const last = data?.at(-1);
  return (
    <Drawer
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      swipeDirection="right"
    >
      <DrawerPanel side="end" size="sm" variant="overlay">
        <DrawerHeader>
          <DrawerHeaderContent>
            <DrawerTitle>{t("workflows.quick_actions.view_change_history")}</DrawerTitle>
          </DrawerHeaderContent>
          <DrawerHeaderActions side="end">
            <ActivitySortRoot
              sortOrder={direction === "asc" ? E_SORT_ORDER.ASC : E_SORT_ORDER.DESC}
              toggleSort={() => setDirection((value) => (value === "asc" ? "desc" : "asc"))}
            />
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t("close")}
              icon={<X className="size-4" />}
              onClick={onClose}
            />
          </DrawerHeaderActions>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-5">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3">
                <History className="mt-0.5 size-4 shrink-0 text-tertiary" />
                <div className="min-w-0 space-y-1 text-body-xs-regular text-primary">
                  <p>
                    {entry.actor_id ? (
                      <Link
                        className="mr-1 font-medium hover:underline"
                        to={`/${workspaceSlug}/profile/${entry.actor_id}/`}
                      >
                        {entry.actor_name}
                      </Link>
                    ) : (
                      <span className="mr-1 font-medium">{entry.actor_name}</span>
                    )}
                    {t(`web.workflow_ui.history.${entry.action}`, {
                      state: entry.data.state_name || t("web.workflow_ui.project_default"),
                      source: entry.data.source_name ?? "",
                      destination: entry.data.destination_name ?? "",
                      value: t(entry.data.value ? "web.workflow_ui.enabled_value" : "web.workflow_ui.disabled_value"),
                    })}
                  </p>
                  <HistorySnapshot entry={entry} />
                  <time className="text-caption-md-regular text-tertiary" dateTime={entry.created_at}>
                    {new Date(entry.created_at).toLocaleString()}
                  </time>
                </div>
              </div>
            ))}
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
