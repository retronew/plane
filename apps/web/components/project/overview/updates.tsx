/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { type Dispatch, type ReactNode, type RefObject, type SetStateAction, useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { Ellipsis } from "lucide-react";
import {
  AddOutline,
  EditOutline,
  DeleteOutline,
  SortAscendingOutline,
  SortDescendingOutline,
  StatusAtRisk,
  StatusOffTrack,
  StatusOnTrack,
} from "@makeplane/propel/icons";
import { Pill, PillLabel } from "@makeplane/propel/elements/pill";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { CircularProgress } from "@makeplane/propel/components/circular-progress";
import { ActionMenuContent } from "@plane/blocks/common";
import { EmptyStateDetailed, getCompactAsset } from "@plane/blocks/empty-state";
import useSWR, { type KeyedMutator } from "swr";
import { Button } from "@makeplane/propel/components/button";
import { TextArea } from "@makeplane/propel/components/text-area";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Translation, useTranslation } from "@plane/i18n";
import type { IProject, IUser, TProjectOverviewUpdate, TProjectUpdateHealth } from "@plane/types";
import { calculateTimeAgo, getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { projectOverviewKey, projectOverviewService } from "@/services/project/project-overview.service";
import { overviewActorName, overviewTranslationKey as key } from "./activity-values";
import { useRefreshProjectActivities } from "./use-refresh-activities";
import { ProjectUpdateDiscussion } from "./update-discussion";

type Props = { project: IProject; workspaceSlug: string };
type UpdateEditorState = { id: string | null; body: string; health: TProjectUpdateHealth };
type AllowPermissions = (
  permissions: EUserPermissions[],
  level: EUserPermissionsLevel,
  workspaceSlug?: string,
  projectId?: string
) => boolean;

const healthOptions: TProjectUpdateHealth[] = ["on_track", "off_track", "at_risk"];
const healthStyles = {
  on_track: { text: "text-label-emerald-text", icon: StatusOnTrack },
  at_risk: { text: "text-label-yellow-text", icon: StatusAtRisk },
  off_track: { text: "text-label-crimson-text", icon: StatusOffTrack },
};

function HealthIcon({ health, compact = false }: { health: TProjectUpdateHealth; compact?: boolean }) {
  const Icon = healthStyles[health].icon;
  return <Icon className={compact ? "size-3.5" : "size-4"} />;
}

function sortUpdates(updates: TProjectOverviewUpdate[], oldestFirst: boolean) {
  // Copy before sorting to preserve the SWR cache and support the app's ES2022 target.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...updates].sort((left, right) => {
    const order = Date.parse(left.created_at) - Date.parse(right.created_at) || left.id.localeCompare(right.id);
    return oldestFirst ? order : -order;
  });
}

function getUpdatePercentage(update: TProjectOverviewUpdate) {
  if (!update.progress || update.progress.total <= 0) return 0;
  return Math.round((update.progress.completed / update.progress.total) * 100);
}

function isUpdatesEnabled(workspaceSlug: string, project: IProject) {
  return Boolean(workspaceSlug && !project.archived_at && project.project_updates_view);
}

function canManageUpdate(
  update: TProjectOverviewUpdate,
  canWrite: boolean,
  admin: boolean,
  userId: string | undefined
) {
  return canWrite && (admin || update.created_by === userId);
}

function getUpdatePermissions({
  user,
  workspaceSlug,
  project,
  workspaceAdmin,
  allowPermissions,
}: {
  user: IUser | undefined;
  workspaceSlug: string;
  project: IProject;
  workspaceAdmin: boolean;
  allowPermissions: AllowPermissions;
}) {
  const enabled = isUpdatesEnabled(workspaceSlug, project);
  const canWrite =
    Boolean(user) &&
    enabled &&
    (workspaceAdmin ||
      allowPermissions(
        [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
        EUserPermissionsLevel.PROJECT,
        workspaceSlug,
        project.id
      ));
  const canInteract = Boolean(user) && enabled;
  const userId = user?.id;
  const admin =
    workspaceAdmin ||
    allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, project.id);
  return {
    canWrite,
    canInteract,
    admin,
    canManage: (update: TProjectOverviewUpdate) => canManageUpdate(update, canWrite, admin, userId),
  };
}

function resolveShowEditor(
  editor: UpdateEditorState | null,
  canWrite: boolean,
  editingUpdate: TProjectOverviewUpdate | undefined,
  canManage: (update: TProjectOverviewUpdate) => boolean
) {
  return Boolean(editor && canWrite && (!editor.id || (editingUpdate && canManage(editingUpdate))));
}

function isNewUpdateEditor(showEditor: boolean, editor: UpdateEditorState | null) {
  return Boolean(showEditor && editor && editor.id === null);
}

function canSaveUpdate(args: {
  projectUpdatesView: boolean;
  editor: UpdateEditorState | null;
  showEditor: boolean;
  saving: RefObject<boolean>;
}) {
  return Boolean(
    args.projectUpdatesView && args.editor && args.showEditor && args.editor.body.trim() && !args.saving.current
  );
}

function canRemoveUpdate(args: {
  projectUpdatesView: boolean;
  deleteTarget: TProjectOverviewUpdate | null;
  canManage: (update: TProjectOverviewUpdate) => boolean;
  saving: RefObject<boolean>;
}) {
  return Boolean(
    args.projectUpdatesView && args.deleteTarget && args.canManage(args.deleteTarget) && !args.saving.current
  );
}

type UpdateMutationContext = {
  projectUpdatesView: boolean;
  workspaceSlug: string;
  projectId: string;
  editor: UpdateEditorState | null;
  showEditor: boolean;
  deleteTarget: TProjectOverviewUpdate | null;
  canManage: (update: TProjectOverviewUpdate) => boolean;
  saving: RefObject<boolean>;
  setPending: Dispatch<SetStateAction<boolean>>;
  setEditor: Dispatch<SetStateAction<UpdateEditorState | null>>;
  setDeleteTarget: Dispatch<SetStateAction<TProjectOverviewUpdate | null>>;
  mutate: KeyedMutator<TProjectOverviewUpdate[]>;
  refreshActivities: () => Promise<void>;
  reportError: () => void;
};

async function saveUpdate(ctx: UpdateMutationContext) {
  if (!canSaveUpdate(ctx) || !ctx.editor) return;
  const { editor } = ctx;
  ctx.saving.current = true;
  ctx.setPending(true);
  try {
    const payload = { body: editor.body, health: editor.health };
    const saved = editor.id
      ? await projectOverviewService.updateUpdate(ctx.workspaceSlug, ctx.projectId, editor.id, payload)
      : await projectOverviewService.createUpdate(ctx.workspaceSlug, ctx.projectId, payload);
    await ctx.mutate(
      (updates = []) =>
        editor.id ? updates.map((update) => (update.id === saved.id ? saved : update)) : [saved, ...updates],
      { revalidate: false }
    );
    ctx.setEditor(null);
    ctx.refreshActivities();
    void ctx.mutate().catch(() => undefined);
  } catch {
    ctx.reportError();
  } finally {
    ctx.saving.current = false;
    ctx.setPending(false);
  }
}

async function removeUpdate(ctx: UpdateMutationContext) {
  const target = ctx.deleteTarget;
  if (!canRemoveUpdate(ctx) || !target) return;
  ctx.saving.current = true;
  ctx.setPending(true);
  try {
    await projectOverviewService.deleteUpdate(ctx.workspaceSlug, ctx.projectId, target.id);
    await ctx.mutate((updates = []) => updates.filter((update) => update.id !== target.id), { revalidate: false });
    if (ctx.editor?.id === target.id) ctx.setEditor(null);
    ctx.setDeleteTarget(null);
    ctx.refreshActivities();
    void ctx.mutate().catch(() => undefined);
  } catch {
    ctx.reportError();
  } finally {
    ctx.saving.current = false;
    ctx.setPending(false);
  }
}

async function retryUpdates(args: {
  retrying: RefObject<boolean>;
  isValidating: boolean;
  mutate: KeyedMutator<TProjectOverviewUpdate[]>;
}) {
  if (args.retrying.current || args.isValidating) return;
  args.retrying.current = true;
  try {
    await args.mutate();
  } catch {
    /* The list keeps its error and retry control. */
  } finally {
    args.retrying.current = false;
  }
}

function createUpdateEditorActions(ctx: {
  saving: RefObject<boolean>;
  setEditor: Dispatch<SetStateAction<UpdateEditorState | null>>;
  setDeleteTarget: Dispatch<SetStateAction<TProjectOverviewUpdate | null>>;
}) {
  return {
    startNew: () => {
      if (!ctx.saving.current) ctx.setEditor({ id: null, body: "", health: "on_track" });
    },
    startEdit: (update: TProjectOverviewUpdate) => {
      if (!ctx.saving.current) ctx.setEditor({ id: update.id, body: update.body, health: update.health });
    },
    requestDelete: (update: TProjectOverviewUpdate) => {
      if (!ctx.saving.current) ctx.setDeleteTarget(update);
    },
    clearDeleteTarget: () => {
      if (!ctx.saving.current) ctx.setDeleteTarget(null);
    },
  };
}

function UpdateEditorForm({
  editor,
  pending,
  saving,
  setEditor,
  onSubmit,
}: {
  editor: UpdateEditorState;
  pending: boolean;
  saving: RefObject<boolean>;
  setEditor: Dispatch<SetStateAction<UpdateEditorState | null>>;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <form
      className="mb-3 w-full shrink-0 overflow-hidden rounded-xl border border-subtle-1 bg-layer-2 transition-[background-color,border-color,box-shadow] focus-within:border-accent-strong focus-within:bg-layer-2-hover focus-within:ring-2 focus-within:ring-accent-strong/20 hover:border-strong hover:bg-layer-2-hover focus-within:hover:border-accent-strong"
      aria-label={t(`${key}.${editor.id ? "edit_update" : "post_update"}`)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col items-start gap-2.5 p-3">
        <Menu>
          <MenuTrigger
            disabled={pending}
            aria-label={`${t(`${key}.health`)}: ${t(`${key}.${editor.health}`)}`}
            render={<Pill size="xs" variant="outline" />}
          >
            <HealthIcon health={editor.health} compact />
            <PillLabel title={t(`${key}.${editor.health}`)}>{t(`${key}.${editor.health}`)}</PillLabel>
          </MenuTrigger>
          <ActionMenuContent side="bottom" align="start">
            <div className="min-w-[180px]">
              {healthOptions.map((health) => (
                <MenuItem
                  key={health}
                  icon={<HealthIcon health={health} />}
                  label={t(`${key}.${health}`)}
                  disabled={pending}
                  onClick={() => {
                    if (!saving.current) setEditor({ ...editor, health });
                  }}
                />
              ))}
            </div>
          </ActionMenuContent>
        </Menu>
        <div className="flex w-full">
          <TextArea
            size="xl"
            surface="inline"
            autoResize
            aria-label={t(`${key}.update_body`)}
            placeholder={t(`${key}.add_update`)}
            value={editor.body}
            rows={2}
            disabled={pending}
            onChange={(event) => setEditor({ ...editor, body: event.target.value })}
          />
        </div>
      </div>
      <div className="flex min-h-9 w-full items-center justify-end gap-1 py-1 pr-1.5 pl-1">
        <Button
          variant="ghost"
          size="sm"
          stretch="auto"
          label={t("cancel")}
          disabled={pending}
          onClick={() => {
            if (!saving.current) setEditor(null);
          }}
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          stretch="auto"
          label={t(pending ? "saving" : editor.id ? "save" : `${key}.add_update`)}
          loading={pending}
          disabled={pending || !editor.body.trim()}
        />
      </div>
    </form>
  );
}

function UpdatesToolbar({
  canWrite,
  pending,
  oldestFirst,
  orderLabel,
  onAdd,
  onToggleSort,
}: {
  canWrite: boolean;
  pending: boolean;
  oldestFirst: boolean;
  orderLabel: string;
  onAdd: () => void;
  onToggleSort: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex min-h-7 items-center justify-between gap-2">
      <div>
        {canWrite && (
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            icon={<AddOutline />}
            label={t(`${key}.add_update`)}
            disabled={pending}
            onClick={onAdd}
          />
        )}
      </div>
      <IconButton
        variant="secondary"
        size="sm"
        aria-label={t(`${key}.sort_updates`)}
        aria-pressed={oldestFirst}
        title={orderLabel}
        onClick={onToggleSort}
        icon={oldestFirst ? <SortDescendingOutline /> : <SortAscendingOutline />}
      />
    </div>
  );
}

type UpdateCardProps = {
  update: TProjectOverviewUpdate;
  workspaceSlug: string;
  projectId: string;
  userId: string | undefined;
  canManage: boolean;
  canInteract: boolean;
  canAdmin: boolean;
  pending: boolean;
  onEdit: (update: TProjectOverviewUpdate) => void;
  onDelete: (update: TProjectOverviewUpdate) => void;
  onRefresh: () => Promise<unknown>;
};

function UpdateCard({
  update,
  workspaceSlug,
  projectId,
  userId,
  canManage,
  canInteract,
  canAdmin,
  pending,
  onEdit,
  onDelete,
  onRefresh,
}: UpdateCardProps) {
  const { t } = useTranslation();
  const percentage = getUpdatePercentage(update);
  const StatusIcon = healthStyles[update.health].icon;
  const authorName = overviewActorName(update.created_by_detail, t("unknown_user"));
  const author = (
    <span className="inline-flex items-center gap-1.5 align-middle text-body-xs-medium text-primary">
      <Avatar size="xs" src={getFileURL(update.created_by_detail?.avatar_url ?? "")} alt={authorName} />
      <span>{authorName}</span>
    </span>
  );
  return (
    <article className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-subtle-1 bg-layer-2">
      <div className="flex flex-col gap-3.5 p-4 pb-0">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <StatusIcon className="size-6 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="min-h-6 py-0.5 text-body-xs-regular break-words text-tertiary">
                <Translation
                  translationKey={`${key}.update_status_message`}
                  components={{
                    actor: update.created_by ? (
                      <Link
                        href={`/${workspaceSlug}/profile/${update.created_by}/`}
                        className="inline-flex rounded-sm align-middle hover:underline focus-visible:outline-2 focus-visible:outline-accent-strong"
                      >
                        {author}
                      </Link>
                    ) : (
                      author
                    ),
                    status: (
                      <span className={`text-body-xs-medium ${healthStyles[update.health].text}`}>
                        {t(`${key}.${update.health}`)}
                      </span>
                    ),
                  }}
                />
              </p>
              <Tooltip label={`${renderFormattedDate(update.created_at)} ${renderFormattedTime(update.created_at)}`}>
                <time
                  dateTime={update.created_at}
                  className="shrink-0 self-start text-caption-md-regular whitespace-nowrap text-placeholder"
                >
                  {calculateTimeAgo(update.created_at)}
                </time>
              </Tooltip>
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center">
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={t(`${key}.update_actions`)}
                      disabled={pending}
                      icon={<Ellipsis className="size-4" />}
                    />
                  }
                />
                <ActionMenuContent side="bottom" align="end">
                  <MenuItem
                    icon={<EditOutline />}
                    label={t(`${key}.edit_update`)}
                    disabled={pending}
                    onClick={() => onEdit(update)}
                  />
                  <MenuItem
                    icon={<DeleteOutline />}
                    label={t(`${key}.delete_update`)}
                    disabled={pending}
                    onClick={() => onDelete(update)}
                  />
                </ActionMenuContent>
              </Menu>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-body-xs-regular break-words whitespace-pre-wrap text-primary">{update.body}</div>
          {update.progress && (
            <div className="flex flex-wrap items-center gap-2 text-body-2xs-regular text-secondary">
              <div className="flex items-center gap-1.5">
                <CircularProgress value={percentage} size="sm" variant="brand" aria-label={t("common.progress")} />
                <span>{t(`${key}.update_completed`, update.progress)}</span>
              </div>
              <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-icon-placeholder" />
              <span>
                {t(`${key}.${update.progress_source === "current" ? "update_current_progress" : "update_progress"}`, {
                  percentage,
                })}
              </span>
            </div>
          )}
        </div>
      </div>
      <ProjectUpdateDiscussion
        update={update}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        userId={userId}
        canInteract={canInteract}
        canAdmin={canAdmin}
        onRefresh={onRefresh}
      />
    </article>
  );
}

function UpdatesFeedback({
  isLoading,
  error,
  isValidating,
  isEmpty,
  onRetry,
}: {
  isLoading: boolean;
  error: unknown;
  isValidating: boolean;
  isEmpty: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {isLoading && !error && <output className="text-13 text-tertiary">{t("loading")}</output>}
      {Boolean(error) && (
        <div role="alert" className="mb-3 space-y-2 text-13 text-danger-primary">
          <p>{t(`${key}.load_error`)}</p>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("common.retry")}
            disabled={isValidating}
            onClick={onRetry}
          />
        </div>
      )}
      {isEmpty && !error && <p className="text-13 text-tertiary">{t(`${key}.no_updates`)}</p>}
    </>
  );
}

function UpdateList({
  updates,
  orderLabel,
  editor,
  showEditor,
  editorForm,
  workspaceSlug,
  projectId,
  userId,
  canManage,
  canInteract,
  canAdmin,
  pending,
  onEdit,
  onDelete,
  onRefresh,
}: {
  updates: TProjectOverviewUpdate[];
  orderLabel: string;
  editor: UpdateEditorState | null;
  showEditor: boolean;
  editorForm: ReactNode;
  workspaceSlug: string;
  projectId: string;
  userId: string | undefined;
  canManage: (update: TProjectOverviewUpdate) => boolean;
  canInteract: boolean;
  canAdmin: boolean;
  pending: boolean;
  onEdit: (update: TProjectOverviewUpdate) => void;
  onDelete: (update: TProjectOverviewUpdate) => void;
  onRefresh: () => Promise<unknown>;
}) {
  return (
    <ol aria-label={orderLabel} className="flex flex-col gap-4 pt-3 pb-20">
      {updates.map((update) => (
        <li key={update.id}>
          {showEditor && editor?.id === update.id ? (
            editorForm
          ) : (
            <UpdateCard
              update={update}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              userId={userId}
              canManage={canManage(update)}
              canInteract={canInteract}
              canAdmin={canAdmin}
              pending={pending}
              onEdit={onEdit}
              onDelete={onDelete}
              onRefresh={onRefresh}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

export const ProjectOverviewUpdates = observer(function ProjectOverviewUpdates(props: Props) {
  const { project, workspaceSlug } = props;
  const { t } = useTranslation();
  if (!project.project_updates_view) {
    return (
      <section aria-label={t(`${key}.updates`)} className="flex min-h-80 items-center justify-center p-10">
        <EmptyStateDetailed
          asset={getCompactAsset("update")}
          align="center"
          title={t(`${key}.updates`)}
          description={t(`${key}.updates_disabled`)}
          customButton={
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              nativeButton={false}
              render={<Link href={`/${workspaceSlug}/settings/projects/${project.id}/project-updates/`} />}
              label={t(`${key}.turn_on_updates`)}
            />
          }
        />
      </section>
    );
  }
  return <Updates key={`${workspaceSlug}:${project.id}`} {...props} />;
});

const Updates = observer(function Updates({ project, workspaceSlug }: Props) {
  const { t } = useTranslation();
  const { data: user } = useUser();
  const { allowPermissions } = useUserPermissions();
  const refreshActivities = useRefreshProjectActivities(workspaceSlug, project.id);
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    workspaceSlug && project.id ? projectOverviewKey(workspaceSlug, project.id, "updates") : null,
    () => projectOverviewService.getUpdates(workspaceSlug, project.id),
    { revalidateOnFocus: true, revalidateOnMount: true }
  );
  const [editor, setEditor] = useState<UpdateEditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TProjectOverviewUpdate | null>(null);
  const [pending, setPending] = useState(false);
  const [oldestFirst, setOldestFirst] = useState(false);
  const saving = useRef(false);
  const retrying = useRef(false);
  const workspaceAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const { canWrite, canInteract, admin, canManage } = getUpdatePermissions({
    user,
    workspaceSlug,
    project,
    workspaceAdmin,
    allowPermissions,
  });
  const editingUpdate = editor?.id ? data?.find((update) => update.id === editor.id) : undefined;
  const showEditor = resolveShowEditor(editor, canWrite, editingUpdate, canManage);
  const sortedUpdates = sortUpdates(data ?? [], oldestFirst);
  const orderLabel = t(`${key}.${oldestFirst ? "oldest_first" : "newest_first"}`);
  const isNewEditor = isNewUpdateEditor(showEditor, editor);
  const projectUpdatesView = Boolean(project.project_updates_view);

  const reportError = () => setToast({ type: "error", title: t("something_went_wrong_please_try_again") });
  const mutationContext: UpdateMutationContext = {
    projectUpdatesView,
    workspaceSlug,
    projectId: project.id,
    editor,
    showEditor,
    deleteTarget,
    canManage,
    saving,
    setPending,
    setEditor,
    setDeleteTarget,
    mutate,
    refreshActivities,
    reportError,
  };
  const save = () => void saveUpdate(mutationContext);
  const remove = () => removeUpdate(mutationContext);
  const retry = () => void retryUpdates({ retrying, isValidating, mutate });
  const actions = createUpdateEditorActions({ saving, setEditor, setDeleteTarget });

  const editorForm =
    showEditor && editor ? (
      <UpdateEditorForm editor={editor} pending={pending} saving={saving} setEditor={setEditor} onSubmit={save} />
    ) : null;

  return (
    <section aria-label={t(`${key}.updates`)} className="min-w-0">
      {!isNewEditor && (
        <UpdatesToolbar
          canWrite={canWrite}
          pending={pending}
          oldestFirst={oldestFirst}
          orderLabel={orderLabel}
          onAdd={actions.startNew}
          onToggleSort={() => setOldestFirst((value) => !value)}
        />
      )}
      {isNewEditor && editorForm}
      <UpdatesFeedback
        isLoading={isLoading}
        error={error}
        isValidating={isValidating}
        isEmpty={data?.length === 0}
        onRetry={retry}
      />
      <UpdateList
        updates={sortedUpdates}
        orderLabel={orderLabel}
        editor={editor}
        showEditor={showEditor}
        editorForm={editorForm}
        workspaceSlug={workspaceSlug}
        projectId={project.id}
        userId={user?.id}
        canManage={canManage}
        canInteract={canInteract}
        canAdmin={admin}
        pending={pending}
        onEdit={actions.startEdit}
        onDelete={actions.requestDelete}
        onRefresh={() => mutate()}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget && canManage(deleteTarget))}
        title={t(`${key}.delete_update`)}
        content={t(`${key}.delete_update_confirm`)}
        isSubmitting={pending}
        handleSubmit={remove}
        handleClose={actions.clearDeleteTarget}
      />
    </section>
  );
});
