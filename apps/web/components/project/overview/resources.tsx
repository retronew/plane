/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { type Dispatch, type ReactNode, type RefObject, type SetStateAction, useRef, useState } from "react";
import Link from "next/link";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { ReactionOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
import useSWR, { type Cache, type ScopedMutator, unstable_serialize, useSWRConfig } from "swr";
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
import type {
  IProject,
  IUser,
  TProjectOverviewAttachment,
  TProjectOverviewLink,
  TProjectOverviewReaction,
} from "@plane/types";
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
type LinkDialogState = { link: TProjectOverviewLink | null; open: boolean };
type ResourceItem = { created_by: string | null };
type ResourceMutation = (resource: string, operation: () => Promise<unknown>, upload: boolean) => Promise<boolean>;
type Translate = ReturnType<typeof useTranslation>["t"];
type AllowPermissions = (
  permissions: EUserPermissions[],
  level: EUserPermissionsLevel,
  workspaceSlug?: string,
  projectId?: string
) => boolean;

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

function getResourcePermissions({
  user,
  project,
  workspaceSlug,
  allowPermissions,
}: {
  user: IUser | undefined;
  project: IProject;
  workspaceSlug: string;
  allowPermissions: AllowPermissions;
}) {
  const archived = Boolean(project.archived_at);
  const canAdmin =
    project.member_role === EUserPermissions.ADMIN ||
    allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const canAdd = Boolean(user) && !archived && (canAdmin || project.member_role === EUserPermissions.MEMBER);
  return { archived, canAdmin, canAdd };
}

function canManageResource(
  item: ResourceItem,
  hasUser: boolean,
  userId: string | undefined,
  archived: boolean,
  canAdmin: boolean
) {
  return hasUser && !archived && (canAdmin || item.created_by === userId);
}

function canReactToResources({
  hasUser,
  archived,
  error,
  loaded,
}: {
  hasUser: boolean;
  archived: boolean;
  error: unknown;
  loaded: boolean;
}) {
  return hasUser && !archived && !error && loaded;
}

function groupResourceReactions(reactions: TProjectOverviewReaction[], userId: string | undefined) {
  const grouped = new Map<string, EmojiReactionType>();
  for (const reaction of reactions) {
    const group = grouped.get(reaction.reaction) ?? {
      emoji: stringToEmoji(reaction.reaction),
      count: 0,
      reacted: false,
      users: [],
    };
    group.count++;
    group.reacted ||= reaction.actor === userId;
    if (reaction.actor_detail?.display_name) group.users?.push(reaction.actor_detail.display_name);
    grouped.set(reaction.reaction, group);
  }
  return grouped;
}

function getDeletionCopy(deletion: Deletion) {
  return deletion.kind === "links"
    ? {
        title: "web.project_overview.delete_link" as const,
        content: "web.project_overview.delete_link_confirm" as const,
      }
    : {
        title: "web.project_overview.delete_attachment" as const,
        content: "web.project_overview.delete_attachment_confirm" as const,
      };
}

function hasResourceError(responses: { error: unknown }[]) {
  return responses.some((response) => Boolean(response.error));
}

function isAnyValidating(responses: { isValidating: boolean }[]) {
  return responses.some((response) => response.isValidating);
}

function retryResourceRequests(requests: { error: unknown; mutate: () => Promise<unknown> }[]) {
  return Promise.allSettled(requests.filter((request) => Boolean(request.error)).map((request) => request.mutate()));
}

async function refreshOverviewResources(
  ctx: { workspaceSlug: string; projectId: string; cache: Cache; mutate: ScopedMutator },
  resource: string
) {
  const activityKey = projectOverviewKey(ctx.workspaceSlug, ctx.projectId, "activities");
  // A filter mutation skips SWRInfinite's aggregate entries. Refresh these explicitly,
  // including first-page keys with appended cursor arguments.
  const infinitePrefix = `$inf$${unstable_serialize(activityKey)}`;
  const infiniteKeys = Array.from(ctx.cache.keys()).filter((key) => key.startsWith(infinitePrefix));
  await Promise.allSettled([
    ctx.mutate(
      (key) =>
        Array.isArray(key) &&
        key[0] === activityKey[0] &&
        key[1] === ctx.workspaceSlug &&
        key[2] === ctx.projectId &&
        (key[3] === resource || key[3] === "activities")
    ),
    ...infiniteKeys.map((key) => ctx.mutate(key)),
  ]);
}

async function mutateOverviewResource(
  ctx: {
    pendingRef: RefObject<boolean>;
    setPending: Dispatch<SetStateAction<boolean>>;
    refresh: (resource: string) => Promise<void>;
    reportError: (upload: boolean) => void;
  },
  resource: string,
  operation: () => Promise<unknown>,
  upload: boolean
) {
  if (ctx.pendingRef.current) return false;
  ctx.pendingRef.current = true;
  ctx.setPending(true);
  try {
    await operation();
    await ctx.refresh(resource);
    return true;
  } catch (error) {
    console.error("Project overview resource mutation failed", error);
    ctx.reportError(upload);
    return false;
  } finally {
    ctx.pendingRef.current = false;
    ctx.setPending(false);
  }
}

async function toggleResourceReaction(
  ctx: {
    canReact: boolean;
    pendingRef: RefObject<boolean>;
    userId: string | undefined;
    reactions: TProjectOverviewReaction[] | undefined;
    workspaceSlug: string;
    projectId: string;
    mutateResource: ResourceMutation;
  },
  reaction: string
) {
  if (!ctx.canReact || ctx.pendingRef.current) return;
  const ownReaction = ctx.reactions?.some((item) => item.reaction === reaction && item.actor === ctx.userId);
  await ctx.mutateResource(
    "reactions",
    () =>
      ownReaction
        ? projectOverviewService.deleteReaction(ctx.workspaceSlug, ctx.projectId, reaction)
        : projectOverviewService.addReaction(ctx.workspaceSlug, ctx.projectId, reaction),
    false
  );
}

async function uploadResourceFile(
  ctx: {
    canAdd: boolean;
    pendingRef: RefObject<boolean>;
    maxFileSize: number;
    setUploadDraft: Dispatch<SetStateAction<File | null>>;
    t: Translate;
    workspaceSlug: string;
    projectId: string;
    mutateResource: ResourceMutation;
  },
  file: File
) {
  if (!ctx.canAdd || ctx.pendingRef.current) return;
  if (file.size > ctx.maxFileSize) {
    setToast({ type: "error", title: ctx.t("attachment.file_size_limit", { size: ctx.maxFileSize / 1024 / 1024 }) });
    return;
  }
  ctx.setUploadDraft(file);
  const succeeded = await ctx.mutateResource(
    "attachments",
    () =>
      fileService.uploadProjectAsset(
        ctx.workspaceSlug,
        ctx.projectId,
        { entity_identifier: ctx.projectId, entity_type: EFileAssetType.PROJECT_ATTACHMENT },
        file
      ),
    true
  );
  if (succeeded) ctx.setUploadDraft(null);
}

async function saveResourceLink(args: {
  data: { title: string; url: string };
  link: TProjectOverviewLink | null;
  canAdd: boolean;
  canManage: (item: ResourceItem) => boolean;
  mutateResource: ResourceMutation;
  workspaceSlug: string;
  projectId: string;
}) {
  const { link } = args;
  if (link ? !args.canManage(link) : !args.canAdd) return false;
  return args.mutateResource(
    "links",
    () =>
      link
        ? projectOverviewService.updateLink(args.workspaceSlug, args.projectId, link.id, args.data)
        : projectOverviewService.createLink(args.workspaceSlug, args.projectId, args.data),
    false
  );
}

async function confirmDeleteResource(args: {
  deletion: Deletion;
  canManage: (item: ResourceItem) => boolean;
  mutateResource: ResourceMutation;
  workspaceSlug: string;
  projectId: string;
  setDeletion: Dispatch<SetStateAction<Deletion | null>>;
}) {
  const { deletion } = args;
  if (!args.canManage(deletion.item)) return;
  const succeeded = await args.mutateResource(
    deletion.kind,
    () =>
      deletion.kind === "links"
        ? projectOverviewService.deleteLink(args.workspaceSlug, args.projectId, deletion.item.id)
        : projectOverviewService.deleteAttachment(args.workspaceSlug, args.projectId, deletion.item.id),
    false
  );
  if (succeeded) args.setDeletion(null);
}

function ResourcesHeader({
  canReact,
  canAdd,
  pending,
  pickerOpen,
  reactions,
  hasReactions,
  fileInput,
  onToggleReaction,
  onPickerOpenChange,
  onAddLink,
  onFile,
}: {
  canReact: boolean;
  canAdd: boolean;
  pending: boolean;
  pickerOpen: boolean;
  reactions: EmojiReactionType[];
  hasReactions: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  onToggleReaction: (reaction: string) => void;
  onPickerOpenChange: (open: boolean) => void;
  onAddLink: () => void;
  onFile: (file: File) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-6">
      <div className="flex flex-wrap items-center gap-2" aria-label={t("web.project_overview.reactions")}>
        <fieldset disabled={!canReact || pending} className="m-0 contents min-w-0 border-0 p-0">
          <EmojiReactionGroup
            className="empty:hidden"
            reactions={reactions}
            showAddButton={false}
            onReactionClick={(emoji) => onToggleReaction(Array.from(emoji, (char) => char.codePointAt(0)).join("-"))}
          />
        </fieldset>
        {canReact && (
          <EmojiReactionPicker
            isOpen={pickerOpen}
            handleToggle={onPickerOpenChange}
            disabled={pending}
            onChange={(reaction) => onToggleReaction(reaction)}
            tooltip={t("common.actions.add_reaction")}
            buttonClassName={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-secondary hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-60",
              !hasReactions && "-ml-[5px]"
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
            onClick={onAddLink}
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
              if (file) onFile(file);
            }}
          />
        </div>
      )}
    </div>
  );
}

function ResourcesErrorAlert({
  pending,
  isValidating,
  onRetry,
}: {
  pending: boolean;
  isValidating: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex items-center gap-2 text-caption-sm-regular text-danger-primary">
      <span>{t("web.project_overview.resources_error")}</span>
      <Button
        stretch="auto"
        variant="ghost"
        size="sm"
        label={t("common.retry")}
        disabled={pending || isValidating}
        onClick={onRetry}
      />
    </div>
  );
}

function UploadDraftRow({
  draft,
  pending,
  canAdd,
  onRetry,
  onCancel,
}: {
  draft: File;
  pending: boolean;
  canAdd: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-caption-sm-regular text-secondary">
      <span className="truncate">{draft.name}</span>
      <Button
        stretch="auto"
        variant="ghost"
        size="sm"
        label={t("common.retry")}
        loading={pending}
        disabled={pending || !canAdd}
        onClick={onRetry}
      />
      <Button stretch="auto" variant="ghost" size="sm" label={t("cancel")} disabled={pending} onClick={onCancel} />
    </div>
  );
}

function ResourceLinksSection({
  links,
  canManage,
  pending,
  onEdit,
  onDelete,
}: {
  links: TProjectOverviewLink[];
  canManage: (item: ResourceItem) => boolean;
  pending: boolean;
  onEdit: (link: TProjectOverviewLink) => void;
  onDelete: (link: TProjectOverviewLink) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="border-t border-subtle py-6">
      <Collapsible
        defaultOpen
        trigger={
          <span className="inline-flex items-center gap-1.5">
            {t("common.links")}
            <span className="text-tertiary">{links.length}</span>
          </span>
        }
        hug
        render={<div className="[&>div:last-child]:-mx-2 [&>div:last-child]:px-2 [&>div>button]:px-0" />}
      >
        <ul className="space-y-1">
          {links.map((link) => (
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
                    onClick={() => onEdit(link)}
                  />
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("web.project_overview.delete_link")}
                    disabled={pending}
                    icon={<Icon icon={<Trash2 />} />}
                    onClick={() => onDelete(link)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}

function ResourceAttachmentsSection({
  attachments,
  workspaceSlug,
  canManage,
  pending,
  onDelete,
}: {
  attachments: TProjectOverviewAttachment[];
  workspaceSlug: string;
  canManage: (item: ResourceItem) => boolean;
  pending: boolean;
  onDelete: (attachment: TProjectOverviewAttachment) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="border-t border-subtle py-6">
      <Collapsible
        defaultOpen
        trigger={
          <span className="inline-flex items-center gap-1.5">
            {t("attachments")}
            <span className="text-tertiary">{attachments.length}</span>
          </span>
        }
        hug
        render={<div className="[&>div:last-child]:-mx-2 [&>div:last-child]:px-2 [&>div>button]:px-0" />}
      >
        <ul className="space-y-1">
          {attachments.map((attachment) => (
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
                  onClick={() => onDelete(attachment)}
                />
              )}
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}

function ResourceLinkDialogContainer({
  dialog,
  pending,
  pendingRef,
  canAdd,
  canManage,
  mutateResource,
  workspaceSlug,
  projectId,
  setDialog,
}: {
  dialog: LinkDialogState | null;
  pending: boolean;
  pendingRef: RefObject<boolean>;
  canAdd: boolean;
  canManage: (item: ResourceItem) => boolean;
  mutateResource: ResourceMutation;
  workspaceSlug: string;
  projectId: string;
  setDialog: Dispatch<SetStateAction<LinkDialogState | null>>;
}) {
  if (!dialog) return null;
  return (
    <ResourceLinkDialog
      open={dialog.open}
      link={dialog.link}
      pending={pending}
      disabled={dialog.link ? !canManage(dialog.link) : !canAdd}
      onClose={() => {
        if (!pendingRef.current) setDialog((current) => (current ? { ...current, open: false } : null));
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setDialog((current) => (current?.open ? current : null));
      }}
      onSave={(data) =>
        saveResourceLink({ data, link: dialog.link, canAdd, canManage, mutateResource, workspaceSlug, projectId })
      }
    />
  );
}

function ResourceDeleteDialog({
  deletion,
  pending,
  pendingRef,
  canManage,
  mutateResource,
  workspaceSlug,
  projectId,
  setDeletion,
}: {
  deletion: Deletion | null;
  pending: boolean;
  pendingRef: RefObject<boolean>;
  canManage: (item: ResourceItem) => boolean;
  mutateResource: ResourceMutation;
  workspaceSlug: string;
  projectId: string;
  setDeletion: Dispatch<SetStateAction<Deletion | null>>;
}) {
  const { t } = useTranslation();
  if (!deletion) return null;
  const copy = getDeletionCopy(deletion);
  return (
    <ConfirmDialog
      isOpen
      title={t(copy.title)}
      content={t(copy.content)}
      isSubmitting={pending}
      isDisabled={!canManage(deletion.item) || pending}
      handleClose={() => {
        if (!pendingRef.current) setDeletion(null);
      }}
      handleSubmit={() =>
        confirmDeleteResource({ deletion, canManage, mutateResource, workspaceSlug, projectId, setDeletion })
      }
    />
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
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadDraft, setUploadDraft] = useState<File | null>(null);
  const { archived, canAdmin, canAdd } = getResourcePermissions({
    user,
    project,
    workspaceSlug,
    allowPermissions,
  });
  const hasUser = Boolean(user);
  const userId = user?.id;
  const canReact = canReactToResources({
    hasUser,
    archived,
    error: reactions.error,
    loaded: reactions.data !== undefined,
  });
  const canManage = (item: ResourceItem) => canManageResource(item, hasUser, userId, archived, canAdmin);
  const grouped = groupResourceReactions(reactions.data ?? [], userId);
  const hasError = hasResourceError([links, attachments, reactions]);
  const isValidating = isAnyValidating([links, attachments, reactions]);

  const reportError = (upload: boolean) =>
    setToast({
      type: "error",
      title: t(upload ? "web.project_overview.upload_failed" : "web.project_overview.resources_error"),
    });
  const refresh = (resource: string) =>
    refreshOverviewResources({ workspaceSlug, projectId: project.id, cache, mutate }, resource);
  const mutateResource: ResourceMutation = (resource, operation, upload) =>
    mutateOverviewResource({ pendingRef, setPending, refresh, reportError }, resource, operation, upload);
  const toggleReaction = (reaction: string) =>
    void toggleResourceReaction(
      {
        canReact,
        pendingRef,
        userId,
        reactions: reactions.data,
        workspaceSlug,
        projectId: project.id,
        mutateResource,
      },
      reaction
    );
  const uploadFile = (file: File) =>
    void uploadResourceFile(
      {
        canAdd,
        pendingRef,
        maxFileSize,
        setUploadDraft,
        t,
        workspaceSlug,
        projectId: project.id,
        mutateResource,
      },
      file
    );
  const retry = () =>
    void retryResourceRequests([
      { error: links.error, mutate: () => links.mutate() },
      { error: attachments.error, mutate: () => attachments.mutate() },
      { error: reactions.error, mutate: () => reactions.mutate() },
    ]);

  return (
    <section>
      <ResourcesHeader
        canReact={canReact}
        canAdd={canAdd}
        pending={pending}
        pickerOpen={pickerOpen}
        reactions={Array.from(grouped.values())}
        hasReactions={grouped.size > 0}
        fileInput={fileInput}
        onToggleReaction={toggleReaction}
        onPickerOpenChange={setPickerOpen}
        onAddLink={() => setLinkDialog({ link: null, open: true })}
        onFile={uploadFile}
      />
      {hasError && <ResourcesErrorAlert pending={pending} isValidating={isValidating} onRetry={retry} />}
      {uploadDraft && (
        <UploadDraftRow
          draft={uploadDraft}
          pending={pending}
          canAdd={canAdd}
          onRetry={() => uploadFile(uploadDraft)}
          onCancel={() => setUploadDraft(null)}
        />
      )}
      {children && <div className="py-6">{children}</div>}
      {!!links.data?.length && (
        <ResourceLinksSection
          links={links.data}
          canManage={canManage}
          pending={pending}
          onEdit={(link) => setLinkDialog({ link, open: true })}
          onDelete={(link) => setDeletion({ kind: "links", item: link })}
        />
      )}
      {!!attachments.data?.length && (
        <ResourceAttachmentsSection
          attachments={attachments.data}
          workspaceSlug={workspaceSlug}
          canManage={canManage}
          pending={pending}
          onDelete={(attachment) => setDeletion({ kind: "attachments", item: attachment })}
        />
      )}
      <ResourceLinkDialogContainer
        dialog={linkDialog}
        pending={pending}
        pendingRef={pendingRef}
        canAdd={canAdd}
        canManage={canManage}
        mutateResource={mutateResource}
        workspaceSlug={workspaceSlug}
        projectId={project.id}
        setDialog={setLinkDialog}
      />
      <ResourceDeleteDialog
        deletion={deletion}
        pending={pending}
        pendingRef={pendingRef}
        canManage={canManage}
        mutateResource={mutateResource}
        workspaceSlug={workspaceSlug}
        projectId={project.id}
        setDeletion={setDeletion}
      />
    </section>
  );
});
