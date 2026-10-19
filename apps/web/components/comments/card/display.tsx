/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";
import { Translation } from "@plane/i18n";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { EditorRefApi } from "@plane/editor";
import { useHashScroll } from "@plane/hooks";
import { GlobeOutline, LockOutline } from "@makeplane/propel/icons";
import { EIssueCommentAccessSpecifier } from "@plane/types";
import type { IUserLite, TCommentsOperations, TIssueComment } from "@plane/types";
import { calculateTimeAgo, cn, getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
// components
import { LiteTextEditor } from "@/components/editor/lite-text";
// local imports
import { CommentReactions } from "../comment-reaction";
import { CommentCardEditForm } from "./edit-form";
import { EmojiReactionButton, EmojiReactionPicker } from "@plane/blocks/emoji-reaction";
import { useMember } from "@/hooks/store/use-member";

export type TCommentCardDisplayProps = {
  activityOperations: TCommentsOperations;
  comment: TIssueComment;
  disabled: boolean;
  isIntakeIssue?: boolean;
  variant?: "default" | "compact";
  entityId: string;
  projectId?: string;
  readOnlyEditorRef: React.RefObject<EditorRefApi | null>;
  showAccessSpecifier: boolean;
  workspaceId: string;
  workspaceSlug: string;
  isEditing?: boolean;
  setIsEditing?: (isEditing: boolean) => void;
  renderFooter?: (ReactionsComponent: ReactNode | null) => ReactNode;
  renderQuickActions?: () => ReactNode;
};

const getCommentDisplayName = (comment: TIssueComment, userDetails: IUserLite | undefined) =>
  comment?.actor_detail?.is_bot
    ? comment?.actor_detail?.first_name + `Bot`
    : (userDetails?.display_name ?? comment?.actor_detail?.display_name);

const getCommentAvatarUrl = (comment: TIssueComment, userDetails: IUserLite | undefined) =>
  userDetails?.avatar_url ?? comment?.actor_detail?.avatar_url;

const hasCommentReactions = (reactionIds: Record<string, string[]> | undefined) =>
  Boolean(reactionIds) && Object.keys(reactionIds ?? {}).some((key) => (reactionIds?.[key]?.length ?? 0) > 0);

function CommentTimestamp({ comment, compact }: { comment: TIssueComment; compact: boolean }) {
  return (
    <div className="text-caption-sm-regular text-tertiary">
      {compact ? (
        <Tooltip
          label={translate("web.ui.date_at_time", {
            date: renderFormattedDate(comment.created_at),
            time: renderFormattedTime(comment.created_at),
          })}
          side="bottom"
          layout="single"
          delay={200}
        >
          <span className="text-12 text-tertiary">
            · {calculateTimeAgo(comment.created_at)}
            {comment.edited_at && translate("web.ui.edited")}
          </span>
        </Tooltip>
      ) : (
        <Translation
          translationKey="web.ui.commented_at"
          components={{
            time: (
              <Tooltip
                label={translate("web.ui.date_at_time", {
                  date: renderFormattedDate(comment.created_at),
                  time: renderFormattedTime(comment.created_at),
                })}
                side="bottom"
                layout="single"
                delay={200}
              >
                <span className="text-tertiary">
                  {calculateTimeAgo(comment.created_at)}
                  {comment.edited_at && translate("web.ui.edited")}
                </span>
              </Tooltip>
            ),
          }}
        />
      )}
    </div>
  );
}

function CommentAccessSpecifier({ access }: { access: EIssueCommentAccessSpecifier }) {
  return (
    <div className="absolute top-2.5 right-2.5 z-[1] text-tertiary">
      {access === EIssueCommentAccessSpecifier.INTERNAL ? (
        <LockOutline className="size-3" />
      ) : (
        <GlobeOutline className="size-3" />
      )}
    </div>
  );
}

type TCommentHeaderProps = {
  avatarUrl: string;
  comment: TIssueComment;
  compact: boolean;
  disabled: boolean;
  displayName: string;
  handleEmojiSelect: (emoji: string) => void;
  isPickerOpen: boolean;
  renderQuickActions?: () => ReactNode;
  setIsPickerOpen: (isPickerOpen: boolean) => void;
};

function CommentHeader(props: TCommentHeaderProps) {
  const {
    avatarUrl,
    comment,
    compact,
    disabled,
    displayName,
    handleEmojiSelect,
    isPickerOpen,
    renderQuickActions,
    setIsPickerOpen,
  } = props;

  return (
    <div className={cn("relative flex w-full items-center gap-2", !compact && "mb-3")}>
      <Avatar
        alt={displayName}
        fallback={displayName?.[0]?.toUpperCase()}
        size={compact ? "xs" : "2xs"}
        src={getFileURL(avatarUrl)}
      />
      <div className="flex flex-1 flex-wrap items-center gap-1">
        <div className={compact ? "text-body-xs-medium" : "text-caption-sm-medium"}>{displayName}</div>
        <CommentTimestamp comment={comment} compact={compact} />
      </div>
      {!disabled && (
        <div className="flex shrink-0 items-center gap-1">
          <EmojiReactionPicker
            isOpen={isPickerOpen}
            handleToggle={setIsPickerOpen}
            onChange={handleEmojiSelect}
            disabled={disabled}
            label={<EmojiReactionButton onAddReaction={() => setIsPickerOpen(true)} />}
            placement="bottom-start"
          />
          {renderQuickActions ? renderQuickActions() : null}
        </div>
      )}
    </div>
  );
}

type TCommentReactionsFooterProps = {
  activityOperations: TCommentsOperations;
  comment: TIssueComment;
  disabled: boolean;
  renderFooter?: (ReactionsComponent: ReactNode | null) => ReactNode;
};

function CommentReactionsFooter(props: TCommentReactionsFooterProps) {
  const { activityOperations, comment, disabled, renderFooter } = props;
  const reactions = <CommentReactions comment={comment} disabled={disabled} activityOperations={activityOperations} />;

  return renderFooter ? renderFooter(reactions) : reactions;
}

type TCommentBodyProps = {
  activityOperations: TCommentsOperations;
  comment: TIssueComment;
  compact: boolean;
  disabled: boolean;
  highlightClassName: string;
  isEditing: boolean;
  projectId?: string;
  readOnlyEditorRef: React.RefObject<EditorRefApi | null>;
  renderFooter?: (ReactionsComponent: ReactNode | null) => ReactNode;
  setIsEditing?: (isEditing: boolean) => void;
  shouldRenderReactions: boolean;
  workspaceId: string;
  workspaceSlug: string;
};

const CommentBody = observer(function CommentBody(props: TCommentBodyProps) {
  const {
    activityOperations,
    comment,
    compact,
    disabled,
    highlightClassName,
    isEditing,
    projectId,
    readOnlyEditorRef,
    renderFooter,
    setIsEditing,
    shouldRenderReactions,
    workspaceId,
    workspaceSlug,
  } = props;

  if (isEditing && setIsEditing) {
    return (
      <CommentCardEditForm
        activityOperations={activityOperations}
        comment={comment}
        isEditing={isEditing}
        readOnlyEditorRef={readOnlyEditorRef.current}
        setIsEditing={setIsEditing}
        projectId={projectId}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />
    );
  }

  return (
    <>
      <LiteTextEditor
        editable={false}
        ref={readOnlyEditorRef}
        id={comment.id}
        initialValue={comment.comment_html ?? ""}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        containerClassName={cn(
          "transition-[border-color] duration-500",
          compact ? "!px-0 !pt-1.5 !pb-0" : "!py-1",
          highlightClassName
        )}
        projectId={projectId?.toString()}
        displayConfig={{
          fontSize: "small-font",
        }}
        parentClassName={cn("border-none", compact && "ml-7")}
      />
      {shouldRenderReactions && (
        <CommentReactionsFooter
          activityOperations={activityOperations}
          comment={comment}
          disabled={disabled}
          renderFooter={renderFooter}
        />
      )}
    </>
  );
});

export const CommentCardDisplay = observer(function CommentCardDisplay(props: TCommentCardDisplayProps) {
  const {
    activityOperations,
    comment,
    disabled,
    isIntakeIssue = false,
    variant = "default",
    projectId,
    readOnlyEditorRef,
    showAccessSpecifier,
    workspaceId,
    workspaceSlug,
    isEditing = false,
    setIsEditing,
    renderFooter,
    renderQuickActions,
  } = props;
  const compact = isIntakeIssue || variant === "compact";
  // states
  const [highlightClassName, setHighlightClassName] = useState("");
  // state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // store hooks
  const { getUserDetails } = useMember();
  // derived values
  const userDetails = getUserDetails(comment?.actor);
  const displayName = getCommentDisplayName(comment, userDetails);
  const avatarUrl = getCommentAvatarUrl(comment, userDetails);

  const userReactions = activityOperations.userReactions(comment.id);

  // navigation
  const pathname = usePathname();
  // derived values
  const commentBlockId = `comment-${comment?.id}`;
  // Check if there are any reactions to determine if we should render the footer
  const shouldRenderReactions = hasCommentReactions(activityOperations.reactionIds(comment.id)) && !disabled;

  // scroll to comment
  const { isHashMatch } = useHashScroll({
    elementId: commentBlockId,
    pathname,
  });

  useEffect(() => {
    if (!isHashMatch) return;
    setHighlightClassName("border-accent-strong");
    const timeout = setTimeout(() => {
      setHighlightClassName("");
    }, 8000);

    return () => clearTimeout(timeout);
  }, [isHashMatch]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (!userReactions) return;
      // emoji is already in decimal string format from EmojiReactionPicker
      void activityOperations.react(comment.id, emoji, userReactions);
    },
    [activityOperations, comment.id, userReactions]
  );

  return (
    <div id={commentBlockId} className="relative flex flex-col gap-2">
      {showAccessSpecifier && <CommentAccessSpecifier access={comment.access} />}
      <CommentHeader
        avatarUrl={avatarUrl}
        comment={comment}
        compact={compact}
        disabled={disabled}
        displayName={displayName}
        handleEmojiSelect={handleEmojiSelect}
        isPickerOpen={isPickerOpen}
        renderQuickActions={renderQuickActions}
        setIsPickerOpen={setIsPickerOpen}
      />
      <CommentBody
        activityOperations={activityOperations}
        comment={comment}
        compact={compact}
        disabled={disabled}
        highlightClassName={highlightClassName}
        isEditing={isEditing}
        projectId={projectId}
        readOnlyEditorRef={readOnlyEditorRef}
        renderFooter={renderFooter}
        setIsEditing={setIsEditing}
        shouldRenderReactions={shouldRenderReactions}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
});
