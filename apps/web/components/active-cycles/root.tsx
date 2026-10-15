import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import useSWRInfinite from "swr/infinite";
import { Button } from "@makeplane/propel/components/button";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IWorkspaceActiveCyclesResponse } from "@plane/types";
import { useUserPermissions } from "@/hooks/store/user";
import { CycleService } from "@/services/cycle.service";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
import { WorkspaceCycleCard } from "./cycle-card";

const cycleService = new CycleService();
const PAGE_SIZE = 10;

export const WorkspaceActiveCycles = observer(function WorkspaceActiveCycles() {
  const { workspaceSlug: slug } = useParams();
  const workspaceSlug = slug?.toString() ?? "";
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const allowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    workspaceSlug
  );
  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<IWorkspaceActiveCyclesResponse>(
      (_index, previous: IWorkspaceActiveCyclesResponse | null) => {
        if (!workspaceSlug || !allowed || (previous && !previous.next_page_results)) return null;
        return ["workspace-active-cycles", workspaceSlug, previous?.next_cursor ?? "10:0:0"] as const;
      },
      ([, workspace, cursor]: readonly [string, string, string]) =>
        cycleService.workspaceActiveCycles(workspace, cursor, PAGE_SIZE),
      { shouldRetryOnError: false, revalidateOnFocus: true }
    );
  const denied = !allowed || (isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0));
  const cycles = [...new Map((data ?? []).flatMap((page) => page.results).map((cycle) => [cycle.id, cycle])).values()];
  const hasMore = data?.[data.length - 1]?.next_page_results ?? false;
  const loadingMore = isValidating || (!!data && size > data.length);

  if (denied)
    return (
      <p role="alert" className="p-6 text-14 text-tertiary">
        {t("workspace_cycles.permission_denied")}
      </p>
    );
  if (isLoading) return <CycleModuleListLayoutLoader />;

  return (
    <div className="vertical-scrollbar scrollbar-lg flex h-full w-full flex-col gap-4 overflow-y-auto px-page-x py-page-y">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg border border-subtle p-4 text-13 text-secondary"
        >
          <span>{t("workspace_cycles.load_error")}</span>
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            label={t("web.retry")}
            disabled={isValidating}
            onClick={() => void mutate().catch(() => undefined)}
          />
        </div>
      )}
      {!error && !cycles.length && (
        <EmptyStateDetailed
          assetKey="cycle"
          title={t("workspace_cycles.empty_title")}
          description={t("workspace_cycles.empty_description")}
          rootClassName="flex-1 justify-center py-16"
        />
      )}
      {cycles.map((cycle) => (
        <WorkspaceCycleCard key={`${workspaceSlug}:${cycle.id}`} cycle={cycle} workspaceSlug={workspaceSlug} />
      ))}
      {hasMore && !error && (
        <div className="flex justify-center">
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            label={t("load_more")}
            loading={loadingMore}
            disabled={loadingMore}
            onClick={() => void setSize(size + 1).catch(() => undefined)}
          />
        </div>
      )}
    </div>
  );
});
