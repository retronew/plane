/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { ReactionOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
import useSWR, { unstable_serialize, useSWRConfig } from "swr";
import { Link as LinkIcon, Paperclip, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { stringToEmoji } from "@plane/blocks/emoji-icon-picker";
import { EmojiReactionGroup, EmojiReactionPicker } from "@plane/blocks/emoji-reaction";
import type { EmojiReactionType } from "@plane/blocks/emoji-reaction";
import { setToast } from "@plane/blocks/toast";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EFileAssetType } from "@plane/types";
import type { IProject, TProjectOverviewAttachment, TProjectOverviewLink } from "@plane/types";
import {
  calculateTimeAgo,
  cn,
  convertBytesToSize,
  getFileURL,
  renderFormattedDate,
  renderFormattedTime,
} from "@plane/utils";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useFileSize } from "@/hooks/use-file-size";
import { FileService } from "@/services/file.service";
import { projectOverviewKey, projectOverviewService } from "@/services/project/project-overview.service";
import { overviewActorName } from "./activity-values";
import { ResourceLinkDialog } from "./resource-link-dialog";
import { isResourceUrl } from "./resource-url";

const fileService = new FileService();
type Props = { project: IProject; workspaceSlug: string; children?: ReactNode };
type Deletion =
  | { kind: "links"; item: TProjectOverviewLink }
  | { kind: "attachments"; item: TProjectOverviewAttachment };

function AttachmentUploader({
  attachment,
  workspaceSlug,
}: {
  attachment: TProjectOverviewAttachment;
  workspaceSlug: string;
}) {
  const { t } = useTranslation();
  const name = overviewActorName(attachment.created_by_detail, t("unknown_user"));
  const avatar = (
    <Avatar
      size="xs"
      src={getFileURL(attachment.created_by_detail?.avatar_url ?? "")}
      alt={name}
      tooltip={!attachment.created_by}
    />
  );
  if (!attachment.created_by) return avatar;
  return (
    <Tooltip label={name}>
      <Link
        href={`/${workspaceSlug}/profile/${attachment.created_by}/`}
        aria-label={name}
        className="inline-flex shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-accent-strong"
      >
        <span aria-hidden="true" className="inline-flex">
          {avatar}
        </span>
      </Link>
    </Tooltip>
  );
}

// Remount local drafts when navigating projects; SWR data is scoped by workspace and project too.
export const ProjectOverviewResources = observer(function ProjectOverviewResources(props: Props) {
  return <ProjectResources key={`${props.workspaceSlug}:${props.project.id}`} {...props} />;
});

const ProjectResources = observer(function ProjectResources({ project, workspaceSlug, children }: Props) {
  const { t } = useTranslation();
  const { data: user } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { maxFileSize } = useFileSize();
  const { mutate, cache } = useSWRConfig();
  const links = useSWR(projectOverviewKey(workspaceSlug, project.id, "links"), () =>
    projectOverviewService.getLinks(workspaceSlug, project.id)
  );
  const attachments = useSWR(projectOverviewKey(workspaceSlug, project.id, "attachments"), () =>
    projectOverviewService.getAttachments(workspaceSlug, project.id)
  );
  const reactions = useSWR(projectOverviewKey(workspaceSlug, project.id, "reactions"), () =>
    projectOverviewService.getReactions(workspaceSlug, project.id)
  );
  const [linkDialog, setLinkDialog] = useState<{ link: TProjectOverviewLink | null; open: boolean } | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadDraft, setUploadDraft] = useState<File | null>(null);
  const archived = Boolean(project.archived_at);
  const canAdmin =
    project.member_role === EUserPermissions.ADMIN ||
    allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const canAdd = Boolean(user) && !archived && (canAdmin || project.member_role === EUserPermissions.MEMBER);
  const canReact = Boolean(user) && !archived && !reactions.error && reactions.data !== undefined;
  const canManage = (item: { created_by: string | null }) =>
    Boolean(user) && !archived && (canAdmin || item.created_by === user?.id);

  const refresh = async (resource: string) => {
    const activityKey = projectOverviewKey(workspaceSlug, project.id, "activities");
    // A filter mutation skips SWRInfinite's aggregate entries. Refresh these explicitly,
    // including first-page keys with appended cursor arguments.
    const infinitePrefix = `$inf$${unstable_serialize(activityKey)}`;
    const infiniteKeys = Array.from(cache.keys()).filter((key) => key.startsWith(infinitePrefix));
    await Promise.allSettled([
      mutate(
        (key) =>
          Array.isArray(key) &&
          key[0] === activityKey[0] &&
          key[1] === workspaceSlug &&
          key[2] === project.id &&
          (key[3] === resource || key[3] === "activities")
      ),
      ...infiniteKeys.map((key) => mutate(key)),
    ]);
  };

  const mutateResource = async (resource: string, operation: () => Promise<unknown>, upload = false) => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    try {
      await operation();
      await refresh(resource);
      return true;
    } catch (error) {
      console.error("Project overview resource mutation failed", error);
      setToast({
        type: "error",
        title: t(upload ? "web.project_overview.upload_failed" : "web.project_overview.resources_error"),
      });
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const toggleReaction = async (reaction: string) => {
    if (!canReact || pendingRef.current) return;
    const ownReaction = reactions.data?.some((item) => item.reaction === reaction && item.actor === user?.id);
    await mutateResource("reactions", () =>
      ownReaction
        ? projectOverviewService.deleteReaction(workspaceSlug, project.id, reaction)
        : projectOverviewService.addReaction(workspaceSlug, project.id, reaction)
    );
  };
  const grouped = new Map<string, EmojiReactionType>();
  for (const reaction of reactions.data ?? []) {
    const group = grouped.get(reaction.reaction) ?? {
      emoji: stringToEmoji(reaction.reaction),
      count: 0,
      reacted: false,
      users: [],
    };
    group.count++;
    group.reacted ||= reaction.actor === user?.id;
    if (reaction.actor_detail?.display_name) group.users?.push(reaction.actor_detail.display_name);
    grouped.set(reaction.reaction, group);
  }

  const uploadFile = async (file: File) => {
    if (!canAdd || pendingRef.current) return;
    if (file.size > maxFileSize) {
      setToast({ type: "error", title: t("attachment.file_size_limit", { size: maxFileSize / 1024 / 1024 }) });
      return;
    }
    setUploadDraft(file);
    if (
      await mutateResource(
        "attachments",
        () =>
          fileService.uploadProjectAsset(
            workspaceSlug,
            project.id,
            { entity_identifier: project.id, entity_type: EFileAssetType.PROJECT_ATTACHMENT },
            file
          ),
        true
      )
    )
      setUploadDraft(null);
  };
  const hasError = links.error || attachments.error || reactions.error;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-6">
        <div className="flex flex-wrap items-center gap-2" aria-label={t("web.project_overview.reactions")}>
          <fieldset disabled={!canReact || pending} className="m-0 contents min-w-0 border-0 p-0">
            <EmojiReactionGroup
              className="empty:hidden"
              reactions={Array.from(grouped.values())}
              showAddButton={false}
              onReactionClick={(emoji) =>
                void toggleReaction(Array.from(emoji, (char) => char.codePointAt(0)).join("-"))
              }
            />
          </fieldset>
          {canReact && (
            <EmojiReactionPicker
              isOpen={pickerOpen}
              handleToggle={setPickerOpen}
              disabled={pending}
              onChange={(reaction) => void toggleReaction(reaction)}
              tooltip={t("common.actions.add_reaction")}
              buttonClassName={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-secondary hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-60",
                grouped.size === 0 && "-ml-[5px]"
              )}
              label={<ReactionOutline className="size-3.5" />}
            />
          )}
        </div>
        {canAdd && (
          <div className="flex items-center gap-2">
            <Button
              stretch="auto"
              variant="secondary"
              size="sm"
              label={t("web.project_overview.add_link")}
              disabled={pending}
              onClick={() => setLinkDialog({ link: null, open: true })}
            />
            <Button
              stretch="auto"
              variant="secondary"
              size="sm"
              label={t("web.project_overview.upload_attachment")}
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            />
            <input
              ref={fileInput}
              type="file"
              hidden
              aria-label={t("web.project_overview.upload_attachment")}
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
          </div>
        )}
      </div>
      {hasError && (
        <div role="alert" className="flex items-center gap-2 text-caption-sm-regular text-danger-primary">
          <span>{t("web.project_overview.resources_error")}</span>
          <Button
            stretch="auto"
            variant="ghost"
            size="sm"
            label={t("common.retry")}
            disabled={pending || links.isValidating || attachments.isValidating || reactions.isValidating}
            onClick={() => {
              void Promise.allSettled([
                ...(links.error ? [links.mutate()] : []),
                ...(attachments.error ? [attachments.mutate()] : []),
                ...(reactions.error ? [reactions.mutate()] : []),
              ]);
            }}
          />
        </div>
      )}
      {uploadDraft && (
        <div className="flex items-center gap-2 text-caption-sm-regular text-secondary">
          <span className="truncate">{uploadDraft.name}</span>
          <Button
            stretch="auto"
            variant="ghost"
            size="sm"
            label={t("common.retry")}
            loading={pending}
            disabled={pending || !canAdd}
            onClick={() => void uploadFile(uploadDraft)}
          />
          <Button
            stretch="auto"
            variant="ghost"
            size="sm"
            label={t("cancel")}
            disabled={pending}
            onClick={() => setUploadDraft(null)}
          />
        </div>
      )}
      {children && <div className="py-6">{children}</div>}
      {!!links.data?.length && (
        <div className="border-t border-subtle py-6">
          <Collapsible
            defaultOpen
            trigger={
              <span className="inline-flex items-center gap-1.5">
                {t("common.links")}
                <span className="text-tertiary">{links.data.length}</span>
              </span>
            }
            hug
            render={<div className="[&>div:last-child]:-mx-2 [&>div:last-child]:px-2 [&>div>button]:px-0" />}
          >
            <ul className="space-y-1">
              {links.data.map((link) => (
                <li
                  key={link.id}
                  className="-mx-2 flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-body-xs-regular hover:bg-layer-1"
                >
                  <LinkIcon className="size-4 shrink-0 text-tertiary" />
                  <div className="min-w-0 flex-1">
                    {isResourceUrl(link.url) ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-primary hover:underline"
                      >
                        {link.title || link.url}
                      </a>
                    ) : (
                      <span className="block truncate">{link.title || link.url}</span>
                    )}
                    <Tooltip label={`${renderFormattedDate(link.created_at)} ${renderFormattedTime(link.created_at)}`}>
                      <time dateTime={link.created_at} className="block truncate text-caption-sm-regular text-tertiary">
                        {t("web.project_overview.link_added_at", { time: calculateTimeAgo(link.created_at) })}
                      </time>
                    </Tooltip>
                  </div>
                  {canManage(link) && (
                    <>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label={t("web.project_overview.edit_link")}
                        disabled={pending}
                        icon={<Icon icon={<Pencil />} />}
                        onClick={() => setLinkDialog({ link, open: true })}
                      />
                      <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label={t("web.project_overview.delete_link")}
                        disabled={pending}
                        icon={<Icon icon={<Trash2 />} />}
                        onClick={() => setDeletion({ kind: "links", item: link })}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Collapsible>
        </div>
      )}
      {!!attachments.data?.length && (
        <div className="border-t border-subtle py-6">
          <Collapsible
            defaultOpen
            trigger={
              <span className="inline-flex items-center gap-1.5">
                {t("attachments")}
                <span className="text-tertiary">{attachments.data.length}</span>
              </span>
            }
            hug
            render={<div className="[&>div:last-child]:-mx-2 [&>div:last-child]:px-2 [&>div>button]:px-0" />}
          >
            <ul className="space-y-1">
              {attachments.data.map((attachment) => (
                <li
                  key={attachment.id}
                  className="-mx-2 flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-body-xs-regular hover:bg-layer-1"
                >
                  <Paperclip className="size-4 shrink-0 text-tertiary" />
                  <a
                    href={attachment.asset_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-primary hover:underline"
                  >
                    {attachment.attributes.name}
                  </a>
                  <span className="shrink-0 text-caption-sm-regular text-tertiary">
                    {convertBytesToSize(attachment.attributes.size)}
                  </span>
                  <AttachmentUploader attachment={attachment} workspaceSlug={workspaceSlug} />
                  {canManage(attachment) && (
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={t("web.project_overview.delete_attachment")}
                      disabled={pending}
                      icon={<Icon icon={<Trash2 />} />}
                      onClick={() => setDeletion({ kind: "attachments", item: attachment })}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Collapsible>
        </div>
      )}
      {linkDialog && (
        <ResourceLinkDialog
          open={linkDialog.open}
          link={linkDialog.link}
          pending={pending}
          disabled={linkDialog.link ? !canManage(linkDialog.link) : !canAdd}
          onClose={() => {
            if (!pendingRef.current) setLinkDialog((dialog) => (dialog ? { ...dialog, open: false } : null));
          }}
          onOpenChangeComplete={(open) => {
            if (!open) setLinkDialog((dialog) => (dialog?.open ? dialog : null));
          }}
          onSave={(data) => {
            const link = linkDialog.link;
            if (link ? !canManage(link) : !canAdd) return Promise.resolve(false);
            return mutateResource("links", () =>
              link
                ? projectOverviewService.updateLink(workspaceSlug, project.id, link.id, data)
                : projectOverviewService.createLink(workspaceSlug, project.id, data)
            );
          }}
        />
      )}
      {deletion && (
        <ConfirmDialog
          isOpen
          title={t(
            deletion.kind === "links" ? "web.project_overview.delete_link" : "web.project_overview.delete_attachment"
          )}
          content={t(
            deletion.kind === "links"
              ? "web.project_overview.delete_link_confirm"
              : "web.project_overview.delete_attachment_confirm"
          )}
          isSubmitting={pending}
          isDisabled={!canManage(deletion.item) || pending}
          handleClose={() => !pendingRef.current && setDeletion(null)}
          handleSubmit={async () => {
            if (!canManage(deletion.item)) return;
            const succeeded = await mutateResource(deletion.kind, () =>
              deletion.kind === "links"
                ? projectOverviewService.deleteLink(workspaceSlug, project.id, deletion.item.id)
                : projectOverviewService.deleteAttachment(workspaceSlug, project.id, deletion.item.id)
            );
            if (succeeded) setDeletion(null);
          }}
        />
      )}
    </section>
  );
});
