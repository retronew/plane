/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { type Dispatch, type RefObject, type SetStateAction, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, MoreHorizontal } from "lucide-react";
import useSWR from "swr";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { TextArea } from "@makeplane/propel/components/text-area";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { DeleteOutline, EditOutline, ReactionOutline } from "@makeplane/propel/icons";
import { ActionMenuContent } from "@plane/blocks/common";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { stringToEmoji } from "@plane/blocks/emoji-icon-picker";
import { EmojiReactionGroup, EmojiReactionPicker } from "@plane/blocks/emoji-reaction";
import type { EmojiReactionType } from "@plane/blocks/emoji-reaction";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectOverviewUpdate, TProjectOverviewUpdateComment } from "@plane/types";
import { calculateTimeAgo, getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { projectOverviewKey, projectOverviewService } from "@/services/project/project-overview.service";
import { overviewActorName, overviewTranslationKey as key } from "./activity-values";

type Props = {
  update: TProjectOverviewUpdate;
  workspaceSlug: string;
  projectId: string;
  canInteract: boolean;
  canAdmin: boolean;
  userId: string | undefined;
  onRefresh: () => Promise<unknown>;
};

const MAX_COMMENT_LENGTH = 100_000;

type UpdateCommentRowProps = {
  comment: TProjectOverviewUpdateComment;
  canEdit: boolean;
  canDelete: boolean;
  editor: { id: string; body: string } | null;
  editorRef: RefObject<HTMLDivElement | null>;
  pending: boolean;
  validEdit: boolean;
  hasError: boolean;
  pendingRef: RefObject<boolean>;
  setEditor: Dispatch<SetStateAction<{ id: string; body: string } | null>>;
  setDeleteTarget: Dispatch<SetStateAction<TProjectOverviewUpdateComment | null>>;
  onSave: () => void;
};

function UpdateCommentRow({
  comment,
  canEdit,
  canDelete,
  editor,
  editorRef,
  pending,
  validEdit,
  hasError,
  pendingRef,
  setEditor,
  setDeleteTarget,
  onSave,
}: UpdateCommentRowProps) {
  const { t } = useTranslation();
  const name = overviewActorName(comment.created_by_detail, t("unknown_user"));
  const editing = editor?.id === comment.id && canEdit;
  return (
    <li className="group/update-comment flex gap-3 not-last:pb-6">
      <div className="relative w-5 shrink-0 self-stretch">
        <div className="mt-1 size-5">
          <Avatar size="xs" src={getFileURL(comment.created_by_detail?.avatar_url ?? "")} alt={name} />
        </div>
        <span
          aria-hidden
          className="absolute top-6 -bottom-7 left-1/2 border-s border-subtle group-last/update-comment:hidden"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-h-6 items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <p className="min-h-6 py-0.5 text-body-xs-regular text-tertiary">
              <span className="font-medium text-primary">{name}</span> {t(`${key}.commented`)}
            </p>
            <span aria-hidden className="bg-placeholder size-1 shrink-0 rounded-full" />
            <Tooltip label={`${renderFormattedDate(comment.created_at)} ${renderFormattedTime(comment.created_at)}`}>
              <time
                dateTime={comment.created_at}
                title={`${renderFormattedDate(comment.created_at)} ${renderFormattedTime(comment.created_at)}`}
                className="text-caption-sm-regular text-placeholder"
              >
                {calculateTimeAgo(comment.created_at)}
              </time>
            </Tooltip>
          </div>
          {canDelete && !editing && (
            <Menu>
              <MenuTrigger
                render={
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("aria_labels.common.more_actions")}
                    icon={<MoreHorizontal className="size-4" />}
                    disabled={pending}
                  />
                }
              />
              <ActionMenuContent side="bottom" align="end">
                {canEdit && (
                  <MenuItem
                    icon={<EditOutline />}
                    label={t("edit")}
                    disabled={pending}
                    onClick={() => {
                      if (!pendingRef.current) setEditor({ id: comment.id, body: comment.body });
                    }}
                  />
                )}
                <MenuItem
                  variant="danger"
                  icon={<DeleteOutline />}
                  label={t(`${key}.delete_comment`)}
                  disabled={pending}
                  onClick={() => {
                    if (!pendingRef.current) setDeleteTarget(comment);
                  }}
                />
              </ActionMenuContent>
            </Menu>
          )}
        </div>
        {editing ? (
          <form
            className="flex flex-col rounded-lg border border-subtle-1 bg-layer-2 focus-within:border-accent-strong"
            onSubmit={(event) => {
              event.preventDefault();
              void onSave();
            }}
          >
            <div ref={editorRef} className="w-full px-3 pt-0.5 [&>textarea]:leading-5">
              <TextArea
                size="lg"
                surface="inline"
                autoResize
                rows={1}
                maxLength={MAX_COMMENT_LENGTH}
                aria-label={t("edit")}
                value={editor.body}
                disabled={pending}
                onChange={(event) => setEditor({ id: comment.id, body: event.target.value })}
              />
            </div>
            <div className="flex items-center justify-end gap-2 py-0.5 pr-1.5 pl-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                stretch="auto"
                label={t("cancel")}
                disabled={pending}
                onClick={() => {
                  if (!pendingRef.current) setEditor(null);
                }}
              />
              <IconButton
                type="submit"
                variant="secondary"
                size="sm"
                aria-label={t("save")}
                icon={<ArrowUp className="size-3.5" />}
                loading={pending}
                disabled={pending || !validEdit || hasError}
              />
            </div>
          </form>
        ) : (
          <p className="text-body-xs-regular break-words whitespace-pre-wrap text-primary">{comment.body}</p>
        )}
      </div>
    </li>
  );
}

type UpdateDiscussionComposerProps = {
  composerRef: RefObject<HTMLFormElement | null>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  pending: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
};

function UpdateDiscussionComposer({
  composerRef,
  draft,
  setDraft,
  pending,
  submitDisabled,
  onSubmit,
}: UpdateDiscussionComposerProps) {
  const { t } = useTranslation();
  return (
    <form
      ref={composerRef}
      className="flex min-h-9 items-center gap-2 rounded-lg border border-subtle-1 bg-layer-2 py-0.5 pr-1.5 pl-3 transition-[background-color,border-color,box-shadow] focus-within:border-accent-strong focus-within:bg-layer-2-hover focus-within:ring-2 focus-within:ring-accent-strong/20 hover:border-strong hover:bg-layer-2-hover focus-within:hover:border-accent-strong"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="flex min-h-6 min-w-0 flex-1 flex-col justify-center [&>textarea]:flex-none [&>textarea]:leading-5 [&>textarea]:placeholder:text-disabled">
        <TextArea
          size="lg"
          surface="inline"
          autoResize
          rows={1}
          maxLength={MAX_COMMENT_LENGTH}
          aria-label={t(`${key}.comment`)}
          placeholder={t(`${key}.add_comment`)}
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <IconButton
          type="submit"
          variant="secondary"
          size="sm"
          aria-label={t("submit")}
          icon={<ArrowUp className="size-3.5" />}
          loading={pending}
          disabled={submitDisabled}
        />
      </div>
    </form>
  );
}

// A reused card must not carry an open discussion or draft into a different update.
export function ProjectUpdateDiscussion(props: Props) {
  return <UpdateDiscussion key={`${props.workspaceSlug}:${props.projectId}:${props.update.id}`} {...props} />;
}

function UpdateDiscussion({ update, workspaceSlug, projectId, canInteract, canAdmin, userId, onRefresh }: Props) {
  const { t } = useTranslation();
  const discussionId = useId();
  const editorRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [editor, setEditor] = useState<{ id: string; body: string } | null>(null);
  const editorId = editor?.id;
  useEffect(() => {
    if (!editorId) return;
    const timeout = setTimeout(() => editorRef.current?.querySelector("textarea")?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [editorId]);
  useEffect(() => {
    if (expanded) composerRef.current?.querySelector("textarea")?.focus();
  }, [expanded]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TProjectOverviewUpdateComment | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const retryingRef = useRef(false);
  const [loadedCount, setLoadedCount] = useState<number | null>(null);
  const comments = useSWR(
    expanded ? projectOverviewKey(workspaceSlug, projectId, `updates/${update.id}/comments`) : null,
    () => projectOverviewService.getUpdateComments(workspaceSlug, projectId, update.id)
  );
  const commentCount = comments.data?.length ?? loadedCount ?? update.comment_count;
  const canWrite = canInteract && Boolean(userId);
  const canEdit = (comment: TProjectOverviewUpdateComment) => canWrite && comment.created_by === userId;
  const canDelete = (comment: TProjectOverviewUpdateComment) => canWrite && (canAdmin || comment.created_by === userId);
  const validEdit = Boolean(editor?.body.trim()) && (editor?.body.length ?? 0) <= MAX_COMMENT_LENGTH;
  const validDraft = Boolean(draft.trim()) && draft.length <= MAX_COMMENT_LENGTH;
  const reportError = () => setToast({ type: "error", title: t("something_went_wrong_please_try_again") });
  const refreshList = () => void onRefresh().catch(() => undefined);

  const submitComment = async () => {
    if (!canWrite || !validDraft || !comments.data || comments.error || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const saved = await projectOverviewService.createUpdateComment(workspaceSlug, projectId, update.id, draft);
      const savedComments = await comments.mutate(
        (items = []) => [...items.filter((item) => item.id !== saved.id), saved],
        {
          revalidate: false,
        }
      );
      if (savedComments) setLoadedCount(savedComments.length);
      setDraft("");
      refreshList();
    } catch {
      reportError();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const saveComment = async () => {
    const comment = comments.data?.find((item) => item.id === editor?.id);
    if (!editor || !comment || !canEdit(comment) || !validEdit || comments.error || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const saved = await projectOverviewService.updateUpdateComment(
        workspaceSlug,
        projectId,
        update.id,
        editor.id,
        editor.body
      );
      await comments.mutate((items = []) => items.map((item) => (item.id === saved.id ? saved : item)), {
        revalidate: false,
      });
      setEditor(null);
      refreshList();
    } catch {
      reportError();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const deleteComment = async () => {
    if (
      !deleteTarget ||
      !canDelete(deleteTarget) ||
      !comments.data?.some((comment) => comment.id === deleteTarget.id) ||
      pendingRef.current
    )
      return;
    pendingRef.current = true;
    setPending(true);
    try {
      await projectOverviewService.deleteUpdateComment(workspaceSlug, projectId, update.id, deleteTarget.id);
      const remainingComments = await comments.mutate(
        (items = []) => items.filter((comment) => comment.id !== deleteTarget.id),
        {
          revalidate: false,
        }
      );
      if (remainingComments) setLoadedCount(remainingComments.length);
      setDeleteTarget(null);
      refreshList();
    } catch {
      reportError();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const toggleReaction = async (reaction: string) => {
    if (!canWrite || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const ownReaction = update.reactions.some((item) => item.reaction === reaction && item.actor === userId);
      if (ownReaction) {
        await projectOverviewService.deleteUpdateReaction(workspaceSlug, projectId, update.id, reaction);
      } else {
        await projectOverviewService.addUpdateReaction(workspaceSlug, projectId, update.id, reaction);
      }
      await onRefresh();
    } catch {
      reportError();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const retryComments = async () => {
    if (retryingRef.current || comments.isValidating) return;
    retryingRef.current = true;
    try {
      await comments.mutate();
    } catch {
      // SWR retains the error so the reader can retry again.
    } finally {
      retryingRef.current = false;
    }
  };

  const grouped = new Map<string, EmojiReactionType>();
  for (const reaction of update.reactions) {
    const group = grouped.get(reaction.reaction) ?? {
      emoji: stringToEmoji(reaction.reaction),
      count: 0,
      reacted: false,
      users: [],
    };
    group.count++;
    group.reacted ||= reaction.actor === userId;
    group.users?.push(overviewActorName(reaction.actor_detail, t("unknown_user")));
    grouped.set(reaction.reaction, group);
  }

  return (
    <>
      <footer className="flex flex-wrap items-center gap-1.5 px-4 pt-3.5 pb-3">
        <div className="-ml-(--control-padding-x-sm) flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            stretch="auto"
            label={`${commentCount > 0 ? `${commentCount} ` : ""}${t(`${key}.comment`)}`}
            aria-expanded={expanded}
            aria-controls={discussionId}
            disabled={pending}
            onClick={() => {
              if (pendingRef.current) return;
              // Keep the actual loaded count when the lazy subscription is closed.
              if (expanded && comments.data) setLoadedCount(comments.data.length);
              setExpanded((open) => !open);
            }}
          />
        </div>
        {(canWrite || grouped.size > 0) && <span aria-hidden className="mx-1.5 h-4 border-s border-strong" />}
        <fieldset disabled={!canWrite || pending} className="m-0 contents min-w-0 border-0 p-0">
          <EmojiReactionGroup
            className="empty:hidden"
            reactions={Array.from(grouped.values())}
            showAddButton={false}
            onReactionClick={(emoji) =>
              void toggleReaction(Array.from(emoji, (character) => character.codePointAt(0)).join("-"))
            }
          />
        </fieldset>
        {canWrite && (
          <EmojiReactionPicker
            isOpen={pickerOpen}
            handleToggle={setPickerOpen}
            disabled={pending}
            onChange={(reaction) => void toggleReaction(reaction)}
            tooltip={t("common.actions.add_reaction")}
            buttonClassName="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-layer-3 text-secondary hover:bg-layer-3-hover focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-60"
            label={<ReactionOutline className="size-3.5" />}
          />
        )}
      </footer>
      <div id={discussionId} hidden={!expanded}>
        {expanded && (
          <div className="flex flex-col gap-4 border-t border-subtle-1 px-4 py-3">
            {comments.isLoading && !comments.error && (
              <output className="text-caption-sm-regular text-tertiary">{t("loading")}</output>
            )}
            {comments.error && (
              <div role="alert" className="flex items-center gap-2 text-caption-sm-regular text-danger-primary">
                <span>{t(`${key}.comments_load_error`)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  stretch="auto"
                  label={t("common.retry")}
                  disabled={comments.isValidating}
                  onClick={() => void retryComments()}
                />
              </div>
            )}
            {!!comments.data?.length && (
              <ol className="flex flex-col">
                {comments.data.map((comment) => (
                  <UpdateCommentRow
                    key={comment.id}
                    comment={comment}
                    canEdit={canEdit(comment)}
                    canDelete={canDelete(comment)}
                    editor={editor}
                    editorRef={editorRef}
                    pending={pending}
                    validEdit={validEdit}
                    hasError={Boolean(comments.error)}
                    pendingRef={pendingRef}
                    setEditor={setEditor}
                    setDeleteTarget={setDeleteTarget}
                    onSave={saveComment}
                  />
                ))}
              </ol>
            )}
            {canWrite && (
              <UpdateDiscussionComposer
                composerRef={composerRef}
                draft={draft}
                setDraft={setDraft}
                pending={pending}
                submitDisabled={pending || !validDraft || !comments.data || Boolean(comments.error)}
                onSubmit={submitComment}
              />
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget && canDelete(deleteTarget))}
        title={t(`${key}.delete_comment`)}
        content={t(`${key}.delete_comment_confirm`)}
        isSubmitting={pending}
        isDisabled={!deleteTarget || !canDelete(deleteTarget) || pending}
        handleSubmit={deleteComment}
        handleClose={() => {
          if (!pendingRef.current) setDeleteTarget(null);
        }}
      />
    </>
  );
}
