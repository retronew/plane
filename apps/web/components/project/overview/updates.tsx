/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Ellipsis, Rocket, TriangleAlert } from "lucide-react";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { ActionMenuContent } from "@plane/blocks/common";
import { EmptyStateDetailed, getCompactAsset } from "@plane/blocks/empty-state";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { TextArea } from "@makeplane/propel/components/text-area";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IProject, TProjectOverviewUpdate, TProjectUpdateHealth } from "@plane/types";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { projectOverviewKey, projectOverviewService } from "@/services/project/project-overview.service";
import { overviewActorName, overviewTranslationKey as key } from "./activity-values";
import { useRefreshProjectActivities } from "./use-refresh-activities";

type Props = { project: IProject; workspaceSlug: string };
const healthOptions: TProjectUpdateHealth[] = ["on_track", "off_track", "at_risk"];
const healthStyles: Record<TProjectUpdateHealth, { text: string; background: string; icon: typeof Rocket }> = {
  on_track: { text: "text-success-primary", background: "bg-success-subtle", icon: Rocket },
  at_risk: { text: "text-warning-primary", background: "bg-warning-subtle", icon: TriangleAlert },
  off_track: { text: "text-danger-primary", background: "bg-danger-subtle", icon: CircleAlert },
};

function HealthIcon({ health, published = false }: { health: TProjectUpdateHealth; published?: boolean }) {
  const Icon = published && health === "on_track" ? CircleCheck : healthStyles[health].icon;
  return <Icon aria-hidden className={`size-4 shrink-0 ${healthStyles[health].text}`} />;
}

function renderHealthIcon(health: TProjectUpdateHealth) {
  return <HealthIcon health={health} />;
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
  const [editor, setEditor] = useState<{ id: string | null; body: string; health: TProjectUpdateHealth } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TProjectOverviewUpdate | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const retrying = useRef(false);
  const workspaceAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const canWrite = Boolean(
    user &&
    workspaceSlug &&
    !project.archived_at &&
    project.project_updates_view &&
    (workspaceAdmin ||
      allowPermissions(
        [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
        EUserPermissionsLevel.PROJECT,
        workspaceSlug,
        project.id
      ))
  );
  const admin =
    workspaceAdmin ||
    allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, project.id);
  const canManage = (update: TProjectOverviewUpdate) => canWrite && (admin || update.created_by === user?.id);
  const editingUpdate = editor?.id ? data?.find((update) => update.id === editor.id) : undefined;
  const showEditor = editor && canWrite && (!editor.id || (editingUpdate && canManage(editingUpdate)));

  const reportError = () => setToast({ type: "error", title: t("something_went_wrong_please_try_again") });
  const save = async () => {
    if (!project.project_updates_view || !editor || !showEditor || !editor.body.trim() || saving.current) return;
    saving.current = true;
    setPending(true);
    try {
      const payload = { body: editor.body, health: editor.health };
      const saved = editor.id
        ? await projectOverviewService.updateUpdate(workspaceSlug, project.id, editor.id, payload)
        : await projectOverviewService.createUpdate(workspaceSlug, project.id, payload);
      await mutate(
        (updates = []) =>
          editor.id ? updates.map((update) => (update.id === saved.id ? saved : update)) : [saved, ...updates],
        { revalidate: false }
      );
      setEditor(null);
      refreshActivities();
      void mutate().catch(() => undefined);
    } catch {
      reportError();
    } finally {
      saving.current = false;
      setPending(false);
    }
  };
  const remove = async () => {
    if (!project.project_updates_view || !deleteTarget || !canManage(deleteTarget) || saving.current) return;
    saving.current = true;
    setPending(true);
    try {
      await projectOverviewService.deleteUpdate(workspaceSlug, project.id, deleteTarget.id);
      await mutate((updates = []) => updates.filter((update) => update.id !== deleteTarget.id), { revalidate: false });
      if (editor?.id === deleteTarget.id) setEditor(null);
      setDeleteTarget(null);
      refreshActivities();
      void mutate().catch(() => undefined);
    } catch {
      reportError();
    } finally {
      saving.current = false;
      setPending(false);
    }
  };
  const retry = async () => {
    if (retrying.current || isValidating) return;
    retrying.current = true;
    try {
      await mutate();
    } catch {
      /* The list keeps its error and retry control. */
    } finally {
      retrying.current = false;
    }
  };

  return (
    <section aria-label={t(`${key}.updates`)} className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-16 font-semibold text-primary">{t(`${key}.updates`)}</h2>
        {canWrite && !showEditor && (
          <Button
            variant="primary"
            size="sm"
            stretch="auto"
            label={t(`${key}.post_update`)}
            disabled={pending}
            onClick={() => {
              if (!saving.current) setEditor({ id: null, body: "", health: "on_track" });
            }}
          />
        )}
      </div>
      {showEditor && (
        <form
          className="mb-5 space-y-3 rounded-lg border border-subtle bg-surface-1 p-4"
          aria-label={t(`${key}.${editor.id ? "edit_update" : "post_update"}`)}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Select<TProjectUpdateHealth>
            getValues={() => healthOptions}
            value={editor.health}
            getOptionValue={(health) => health}
            getOptionLabel={(health) => t(`${key}.${health}`)}
            getOptionIcon={renderHealthIcon}
            showSearch={false}
            placeholder={t(`${key}.health`)}
            disabled={pending}
            onChange={(health) => {
              if (!saving.current && healthOptions.includes(health as TProjectUpdateHealth))
                setEditor({ ...editor, health: health as TProjectUpdateHealth });
            }}
          >
            <Select.Trigger
              variant="select-md"
              aria-label={t(`${key}.health`)}
              className={`w-fit ${healthStyles[editor.health].background} ${healthStyles[editor.health].text}`}
            >
              <Select.Value />
            </Select.Trigger>
          </Select>
          <TextArea
            size="lg"
            surface="inline"
            aria-label={t(`${key}.update_body`)}
            placeholder={t(`${key}.update_body`)}
            value={editor.body}
            rows={4}
            disabled={pending}
            onChange={(event) => setEditor({ ...editor, body: event.target.value })}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
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
              variant="primary"
              size="sm"
              stretch="auto"
              label={t(pending ? "saving" : editor.id ? "save" : `${key}.add_update`)}
              loading={pending}
              disabled={pending || !editor.body.trim()}
            />
          </div>
        </form>
      )}
      {isLoading && !error && <output className="text-13 text-tertiary">{t("loading")}</output>}
      {error && (
        <div role="alert" className="mb-3 space-y-2 text-13 text-danger-primary">
          <p>{t(`${key}.load_error`)}</p>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("common.retry")}
            disabled={isValidating}
            onClick={() => void retry()}
          />
        </div>
      )}
      {data?.length === 0 && !error && <p className="text-13 text-tertiary">{t(`${key}.no_updates`)}</p>}
      <ol className="space-y-4">
        {data?.map((update) => (
          <li key={update.id} className="space-y-4 rounded-lg border border-subtle bg-surface-1 p-4 text-13">
            <div className="flex items-start gap-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${healthStyles[update.health].background}`}
              >
                <HealthIcon health={update.health} published />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${healthStyles[update.health].text}`}>{t(`${key}.${update.health}`)}</p>
                <p className="mt-1 text-11 break-words text-tertiary">
                  <time dateTime={update.created_at} title={renderFormattedTime(update.created_at)}>
                    {renderFormattedDate(update.created_at)}
                  </time>
                  <span aria-hidden> · </span>
                  <span>{overviewActorName(update.created_by_detail, t("unknown_user"))}</span>
                </p>
              </div>
              {canManage(update) && (
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
                      label={t(`${key}.edit_update`)}
                      disabled={pending}
                      onClick={() => {
                        if (!saving.current) setEditor({ id: update.id, body: update.body, health: update.health });
                      }}
                    />
                    <MenuItem
                      label={t(`${key}.delete_update`)}
                      disabled={pending}
                      onClick={() => {
                        if (!saving.current) setDeleteTarget(update);
                      }}
                    />
                  </ActionMenuContent>
                </Menu>
              )}
            </div>
            <p className="break-words whitespace-pre-wrap text-primary">{update.body}</p>
          </li>
        ))}
      </ol>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget && canManage(deleteTarget))}
        title={t(`${key}.delete_update`)}
        content={t(`${key}.delete_update_confirm`)}
        isSubmitting={pending}
        handleSubmit={remove}
        handleClose={() => {
          if (!saving.current) setDeleteTarget(null);
        }}
      />
    </section>
  );
});
