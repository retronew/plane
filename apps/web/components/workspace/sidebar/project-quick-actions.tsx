import { useState } from "react";
import { observer } from "mobx-react";
import { useRouter } from "next/navigation";
import { Icon } from "@makeplane/propel/components/icon";
import { MenuItem, MenuSeparator } from "@makeplane/propel/components/menu";
import { ArchiveOutline, LinkOutline, RemoveOutline, SettingsOutline, ShareOutline } from "@makeplane/propel/icons";
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TPartialProject } from "@plane/types";
import { ActionMenuContent, FavoriteStarIcon } from "@plane/blocks/common";
import { setToast } from "@plane/blocks/toast";
import { ArchiveRestoreProjectModal } from "@/components/project/archive-restore-modal";
import { LeaveProjectModal } from "@/components/project/leave-project-modal";
import { PublishProjectModal } from "@/components/project/publish-project/modal";
import { useFavorite } from "@/hooks/store/use-favorite";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import useLocalStorage from "@/hooks/use-local-storage";

type Props = {
  workspaceSlug: string;
  project: TPartialProject;
  onCopyLink: () => void;
};

export const SidebarProjectQuickActions = observer(function SidebarProjectQuickActions({
  workspaceSlug,
  project,
  onCopyLink,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { allowPermissions } = useUserPermissions();
  const { entityMap, removeFavoriteEntity } = useFavorite();
  const { addProjectToFavorites } = useProject();
  const { setValue: expandFavorites } = useLocalStorage(IS_FAVORITE_MENU_OPEN, false);
  const [dialog, setDialog] = useState<"publish" | "archive" | "leave" | null>(null);
  const [updatingFavorite, setUpdatingFavorite] = useState(false);
  const isFavorite = Boolean(entityMap[project.id]);
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, project.id);
  const canOpenArchives = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    project.id
  );
  const canLeave = Boolean(project.member_role);
  const closeDialog = () => setDialog(null);

  const toggleFavorite = async () => {
    if (updatingFavorite) return;
    setUpdatingFavorite(true);
    try {
      if (isFavorite) await removeFavoriteEntity(workspaceSlug, project.id);
      else {
        await addProjectToFavorites(workspaceSlug, project.id);
        expandFavorites(true);
      }
      setToast({
        type: "success",
        title: t("toast.success"),
        message: t(isFavorite ? "project_removed_from_favorites" : "project_added_to_favorites"),
      });
    } catch {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t(isFavorite ? "couldnt_remove_the_project_from_favorites" : "couldnt_add_the_project_to_favorites"),
      });
    } finally {
      setUpdatingFavorite(false);
    }
  };

  return (
    <>
      <PublishProjectModal isOpen={dialog === "publish"} projectId={project.id} onClose={closeDialog} />
      <ArchiveRestoreProjectModal
        workspaceSlug={workspaceSlug}
        projectId={project.id}
        isOpen={dialog === "archive"}
        onClose={closeDialog}
        archive
      />
      <LeaveProjectModal project={project} isOpen={dialog === "leave"} onClose={closeDialog} />
      <ActionMenuContent side="bottom" align="start">
        <MenuItem
          icon={<Icon icon={SettingsOutline} />}
          label={t("settings")}
          onClick={() => router.push(`/${workspaceSlug}/settings/projects/${project.id}/`)}
        />
        <MenuItem icon={<Icon icon={LinkOutline} />} label={t("copy_link")} onClick={onCopyLink} />
        <MenuItem
          icon={<Icon icon={<FavoriteStarIcon selected={isFavorite} />} />}
          label={t(isFavorite ? "remove_from_favorites" : "add_to_favorites")}
          disabled={updatingFavorite}
          onClick={() => void toggleFavorite()}
        />
        {isAdmin && (
          <MenuItem
            icon={<Icon icon={ShareOutline} />}
            label={t("publish_project")}
            onClick={() => setDialog("publish")}
          />
        )}
        {canOpenArchives && (
          <MenuItem
            icon={<Icon icon={ArchiveOutline} />}
            label={t("web.project_quick_actions.open_archives")}
            onClick={() => router.push(`/${workspaceSlug}/projects/${project.id}/archives/issues/`)}
          />
        )}
        {(isAdmin || canLeave) && <MenuSeparator />}
        {isAdmin && (
          <MenuItem
            icon={<Icon icon={ArchiveOutline} />}
            label={t("web.project_quick_actions.archive_project")}
            onClick={() => setDialog("archive")}
          />
        )}
        {canLeave && (
          <MenuItem
            variant="danger"
            icon={<Icon icon={RemoveOutline} />}
            label={t("leave_project")}
            onClick={() => setDialog("leave")}
          />
        )}
      </ActionMenuContent>
    </>
  );
});
