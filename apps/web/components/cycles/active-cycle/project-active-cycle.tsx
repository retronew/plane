import { observer } from "mobx-react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { ActiveCycleRoot } from "./root";
import { Loader } from "@plane/blocks/skeleton";
import { WorkspaceCycleCard } from "@/components/active-cycles/cycle-card";
import { CyclesListItem } from "@/components/cycles/list/cycles-list-item";
import { useCycle } from "@/hooks/store/use-cycle";
import { useProject } from "@/hooks/store/use-project";
import { CycleService } from "@/services/cycle.service";
import { projectActiveCycleData } from "./project-active-cycle-data";

const cycleService = new CycleService();

export type ProjectActiveCycleProps = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
};

/** Guests retain the original project analytics, which supports their existing read permission. */
export const ProjectActiveCycle = observer(function ProjectActiveCycle(props: ProjectActiveCycleProps) {
  const { allowPermissions } = useUserPermissions();
  const canReadSnapshots =
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.WORKSPACE,
      props.workspaceSlug
    ) &&
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      props.workspaceSlug,
      props.projectId
    );
  return canReadSnapshots ? <MemberProjectActiveCycle {...props} /> : <ActiveCycleRoot {...props} showHeader={false} />;
});

/** Shared workspace chart with project-scoped snapshots and the original project actions. */
const MemberProjectActiveCycle = observer(function MemberProjectActiveCycle({
  workspaceSlug,
  projectId,
  cycleId,
}: ProjectActiveCycleProps) {
  const { t } = useTranslation();
  const { getCycleById, fetchCycleDetails } = useCycle();
  const { getProjectById, fetchProjectDetails } = useProject();
  const cycle = getCycleById(cycleId);
  const project = getProjectById(projectId);
  const { error: detailsError, mutate: reloadDetails } = useSWR(
    ["project-active-cycle-details", workspaceSlug, projectId, cycleId],
    () => fetchCycleDetails(workspaceSlug, projectId, cycleId),
    { revalidateOnFocus: false }
  );
  const { error: projectError, mutate: reloadProject } = useSWR(
    !project?.timezone ? ["project-active-cycle-project", workspaceSlug, projectId] : null,
    () => fetchProjectDetails(workspaceSlug, projectId),
    { revalidateOnFocus: false }
  );
  const {
    data: snapshots,
    error: historyError,
    mutate: reloadHistory,
  } = useSWR(
    ["project-active-cycle-history", workspaceSlug, projectId, cycleId],
    () => cycleService.workspaceActiveCyclesProgressPro(workspaceSlug, projectId, cycleId),
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  if (detailsError || projectError || historyError) {
    return (
      <div role="alert" className="flex items-center justify-center gap-3 p-6 text-secondary">
        <span>{t("something_went_wrong")}</span>
        <Button
          stretch="auto"
          variant="secondary"
          size="sm"
          label={t("web.retry")}
          onClick={() => {
            void reloadDetails();
            void reloadProject();
            void reloadHistory();
          }}
        />
      </div>
    );
  }
  if (!cycle || !project?.timezone || !snapshots) {
    return (
      <Loader className="p-4">
        <Loader.Item height="440px" width="100%" />
      </Loader>
    );
  }
  const data = projectActiveCycleData(cycle, project, snapshots);
  if (!data) return null;

  return (
    <WorkspaceCycleCard
      cycle={data}
      workspaceSlug={workspaceSlug}
      showProject={false}
      header={
        <CyclesListItem
          cycleId={cycleId}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          className="!border-b-transparent"
        />
      }
    />
  );
});
