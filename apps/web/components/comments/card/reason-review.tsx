import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@makeplane/propel/components/button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ActionMenuContent } from "@plane/blocks/common";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TIssueComment } from "@plane/types";
import { useUser } from "@/hooks/store/user";
import { useMember } from "@/hooks/store/use-member";
import { CommentReviewService, commentReviewsKey } from "@/services/comment-review.service";
import type { TCommentReview, TCommentReviewStatus } from "@/services/comment-review.service";

const service = new CommentReviewService();
// Keep edit fingerprints with the SWR provider, including across card remounts.
const contentVersions = new WeakMap<object, Map<string, string>>();
const isMemberWorkKey = (key: unknown) => Array.isArray(key) && key[0] === "member-work";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  comment: TIssueComment;
  disabled?: boolean;
};

function useReasonReview({ workspaceSlug, projectId, issueId, comment, disabled = false }: Props) {
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const { cache, mutate: globalMutate } = useSWRConfig();
  const { data, error, mutate, isValidating } = useSWR(
    currentUser ? commentReviewsKey(workspaceSlug, projectId, issueId, currentUser.id) : null,
    () => service.getReviews(workspaceSlug, projectId, issueId)
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [refreshError, setRefreshError] = useState(false);
  const [, setRefreshVersion] = useState(0);
  let versions = contentVersions.get(cache);
  if (!versions) {
    versions = new Map();
    contentVersions.set(cache, versions);
  }
  const versionId = JSON.stringify([workspaceSlug, projectId, issueId, currentUser?.id, comment.id]);
  const signature = JSON.stringify([comment.edited_at, comment.comment_html]);
  const previousSignature = versions.get(versionId);
  const contentChanged = previousSignature !== undefined && previousSignature !== signature;

  useEffect(() => {
    if (!versions.has(versionId)) {
      versions.set(versionId, signature);
      return;
    }
    if (versions.get(versionId) === signature) return;
    let active = true;
    void mutate().then(
      () => {
        if (!active) return;
        setRefreshError(false);
        versions.set(versionId, signature);
        setRefreshVersion((value) => value + 1);
        void globalMutate(isMemberWorkKey).catch(() => undefined);
        return undefined;
      },
      () => {
        if (active) setRefreshError(true);
      }
    );
    return () => {
      active = false;
    };
  }, [globalMutate, mutate, signature, versionId, versions]);

  const review = data?.reviews.find((item) => item.comment_id === comment.id);
  const isSelf = currentUser?.id === comment.actor || currentUser?.id === comment.created_by;
  const canReview = Boolean(data?.can_review && currentUser && !isSelf && !disabled && !contentChanged);
  const retry = async () => {
    setRefreshError(false);
    try {
      await mutate();
      versions.set(versionId, signature);
      setRefreshVersion((value) => value + 1);
      void globalMutate(isMemberWorkKey).catch(() => undefined);
    } catch {
      setRefreshError(true);
    }
  };
  const submit = async (status: TCommentReviewStatus) => {
    if (!canReview || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const updated = await service.reviewComment(workspaceSlug, projectId, issueId, comment.id, status);
      await mutate(
        (current) =>
          current && {
            ...current,
            reviews: current.reviews.map((item) => (item.comment_id === comment.id ? updated : item)),
          },
        { revalidate: false }
      );
      void globalMutate(isMemberWorkKey).catch(() => undefined);
    } catch (cause) {
      const httpStatus = (cause as { response?: { status?: number } })?.response?.status;
      setToast({
        type: "error",
        title: t("web.reason_review_save_failed"),
        message: httpStatus === 403 ? t("web.reason_review_forbidden") : t("web.reason_review_retry_message"),
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return {
    currentUser,
    data,
    review,
    isSelf,
    canReview,
    busy,
    isValidating,
    retry,
    submit,
    loadFailed: Boolean(error || refreshError),
    loading: !data || contentChanged,
  };
}

function ReviewTime({ value }: { value: string }) {
  const date = new Date(value);
  const text = Number.isNaN(date.getTime()) ? "—" : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
  return <time dateTime={value}>{text}</time>;
}
function ReviewHistory({ events }: { events: TCommentReview["history"] }) {
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  return (
    <ol aria-label={t("web.reason_review_history")} className="flex flex-col gap-1 border-l border-subtle pl-3">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center gap-2">
          <span>{t(`web.reason_review_${event.status}`)}</span>
          <span>
            {getUserDetails(event.reviewer_id ?? "")?.display_name || t("web.reason_review_unknown_reviewer")}
          </span>
          {event.reviewed_at && <ReviewTime value={event.reviewed_at} />}
        </li>
      ))}
    </ol>
  );
}
function ReviewAttribution({ review }: { review: TCommentReview | undefined }) {
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  if (!review?.reviewer_id || review.is_stale || review.status === "unreviewed") return null;
  return (
    <>
      <span>{getUserDetails(review.reviewer_id)?.display_name || t("web.reason_review_unknown_reviewer")}</span>
      {review.reviewed_at && <ReviewTime value={review.reviewed_at} />}
    </>
  );
}
function ReviewMenu({
  label,
  enabled,
  busy,
  canClear,
  submit,
}: {
  label: string;
  enabled: boolean;
  busy: boolean;
  canClear: boolean;
  submit: (status: TCommentReviewStatus) => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            stretch="auto"
            size="sm"
            disabled={!enabled || busy}
            aria-label={t("web.reason_review_action")}
            label={label}
          />
        }
      />
      <ActionMenuContent align="start">
        <MenuItem
          label={t("web.reason_review_mark_justified")}
          disabled={busy}
          onClick={() => void submit("justified")}
        />
        <MenuItem
          label={t("web.reason_review_mark_unjustified")}
          disabled={busy}
          onClick={() => void submit("unjustified")}
        />
        <MenuItem
          label={t("web.reason_review_clear")}
          disabled={busy || !canClear}
          onClick={() => void submit("unreviewed")}
        />
      </ActionMenuContent>
    </Menu>
  );
}

export const CommentReasonReview = observer(function CommentReasonReview(props: Props) {
  const { t } = useTranslation();
  const state = useReasonReview(props);
  const [showHistory, setShowHistory] = useState(false);
  if (!state.currentUser) return null;
  if (state.loadFailed)
    return (
      <div className="flex flex-wrap items-center gap-2 text-caption-sm-regular text-tertiary">
        <span>{t("web.reason_review_load_failed")}</span>
        <Button
          variant="ghost"
          stretch="auto"
          size="sm"
          disabled={state.isValidating}
          onClick={() => void state.retry()}
          label={t("web.reason_review_retry")}
        />
      </div>
    );
  if (state.loading)
    return <output className="text-caption-sm-regular text-tertiary">{t("web.reason_review_loading")}</output>;
  const { review, data } = state;
  const status = review?.status ?? "unreviewed";
  const label = review?.is_stale ? t("web.reason_review_stale") : t(`web.reason_review_${status}`);
  const tooltip =
    state.isSelf && data?.can_review ? t("web.reason_review_self_disabled") : t("web.reason_review_admin_hint");
  const hasHistory = Boolean(review?.history.length);
  return (
    <div className="flex flex-col gap-1 text-caption-sm-regular text-tertiary">
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip label={tooltip}>
          <span className="inline-flex items-center">
            {data?.can_review ? (
              <ReviewMenu
                label={label}
                enabled={state.canReview}
                busy={state.busy}
                canClear={status !== "unreviewed" || Boolean(review?.is_stale)}
                submit={state.submit}
              />
            ) : (
              <span>{label}</span>
            )}
          </span>
        </Tooltip>
        <ReviewAttribution review={review} />
        {hasHistory && (
          <Button
            variant="ghost"
            stretch="auto"
            size="sm"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((value) => !value)}
            label={t("web.reason_review_history")}
          />
        )}
      </div>
      {review?.is_stale && <span>{t("web.reason_review_stale_hint")}</span>}
      {showHistory && hasHistory && <ReviewHistory events={review?.history ?? []} />}
    </div>
  );
});
