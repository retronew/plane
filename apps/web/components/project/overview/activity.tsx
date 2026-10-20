/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { SortAscendingOutline, SortDescendingOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TProjectActivityOrder, TProjectOverviewActivity, TProjectOverviewActivityPage } from "@plane/types";
import { projectOverviewService } from "@/services/project/project-overview.service";
import { ProjectActivityDetailDialog } from "./activity-detail-dialog";
import { ProjectActivityEntry } from "./activity-entry";
import { overviewTranslationKey as key } from "./activity-values";

type ActivityKey = readonly ["project-overview", string, string, "activities", TProjectActivityOrder, string];

export function ProjectOverviewActivity({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const [orderBy, setOrderBy] = useState<TProjectActivityOrder>("-created_at");
  return (
    <ActivityFeed
      key={`${workspaceSlug}:${projectId}:${orderBy}`}
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      orderBy={orderBy}
      onToggleOrder={() => setOrderBy((order) => (order === "-created_at" ? "created_at" : "-created_at"))}
    />
  );
}

function ActivityFeed({
  workspaceSlug,
  projectId,
  orderBy,
  onToggleOrder,
}: {
  workspaceSlug: string;
  projectId: string;
  orderBy: TProjectActivityOrder;
  onToggleOrder: () => void;
}) {
  const { t } = useTranslation();
  const requesting = useRef(false);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<{ entry: TProjectOverviewActivity; open: boolean } | null>(null);
  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite<TProjectOverviewActivityPage>(
    (index, previous: TProjectOverviewActivityPage | null): ActivityKey | null => {
      if (!workspaceSlug || !projectId || (previous && (!previous.next_page_results || !previous.next_cursor)))
        return null;
      return [
        "project-overview",
        workspaceSlug,
        projectId,
        "activities",
        orderBy,
        index === 0 ? "" : previous!.next_cursor,
      ];
    },
    ([, slug, id, , order, cursor]: ActivityKey) =>
      projectOverviewService.getActivities(slug, id, cursor || undefined, order),
    { revalidateOnFocus: true, revalidateOnMount: true, revalidateAll: true }
  );
  const seen = new Set<string>();
  const entries = (data ?? [])
    .flatMap((page) => page.results)
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  const last = data?.at(-1);
  const busy = pending || isValidating;
  const request = async (loadMore: boolean) => {
    if (requesting.current || isValidating) return;
    requesting.current = true;
    setPending(true);
    try {
      if (loadMore) await setSize(size + 1);
      else await mutate();
    } catch {
      // Keep the loaded pages while exposing the failure and retry action.
    } finally {
      requesting.current = false;
      setPending(false);
    }
  };
  const toggleOrder = () => {
    // Reset this sort's cached page count before leaving it so returning starts at page one.
    void setSize(1).catch(() => undefined);
    onToggleOrder();
  };
  const orderLabel = t(`${key}.${orderBy === "-created_at" ? "newest_first" : "oldest_first"}`);
  return (
    <section aria-label={t("activity")} className="flex min-h-0 w-full flex-col">
      <div className="mb-3 flex min-h-7 shrink-0 items-center justify-between gap-2">
        <h2 className="text-h6-semibold text-secondary">{t("activity")}</h2>
        <Tooltip label={orderLabel}>
          <IconButton
            variant="secondary"
            size="sm"
            showTooltip={false}
            aria-label={t(`${key}.sort_activity`)}
            aria-pressed={orderBy === "created_at"}
            onClick={toggleOrder}
            icon={orderBy === "-created_at" ? <SortAscendingOutline /> : <SortDescendingOutline />}
          />
        </Tooltip>
      </div>
      {!data && !error && <output className="text-13 text-tertiary">{t("loading")}</output>}
      {data && !error && entries.length === 0 && <p className="text-13 text-tertiary">{t(`${key}.no_activity`)}</p>}
      <ol aria-label={orderLabel} className="min-w-0 pt-3 pb-5">
        {entries.map((entry, index) => (
          <ProjectActivityEntry
            key={entry.id}
            entry={entry}
            workspaceSlug={workspaceSlug}
            first={index === 0}
            last={index === entries.length - 1}
            onSelect={(selectedEntry) => setSelected({ entry: selectedEntry, open: true })}
          />
        ))}
      </ol>
      {error && (
        <div role="alert" className="mt-3 space-y-2 text-13 text-danger-primary">
          <p>{t(`${key}.load_error`)}</p>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("common.retry")}
            disabled={busy}
            onClick={() => void request(false)}
          />
        </div>
      )}
      {!error && last?.next_page_results && last.next_cursor && (
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={t(`${key}.load_more`)}
          loading={busy}
          disabled={busy}
          onClick={() => void request(true)}
        />
      )}
      {selected && (
        <ProjectActivityDetailDialog
          entry={selected.entry}
          open={selected.open}
          onClose={() => setSelected((current) => (current ? { ...current, open: false } : null))}
          onOpenChangeComplete={(open) => {
            if (!open) setSelected((current) => (current?.open ? current : null));
          }}
        />
      )}
    </section>
  );
}
