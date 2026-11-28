import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";

import { useTranslation, translate } from "@plane/i18n";
import { DeleteOutline, EditOutline, LinkOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
import { Copy } from "lucide-react";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssueServiceType } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// ui
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { calculateTimeAgo, copyTextToClipboard, renderFormattedDate } from "@plane/utils";
// components
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { usePlatformOS } from "@/hooks/use-platform-os";
import type { TLinkOperationsModal } from "./create-update-link-modal";

type TIssueLinkItem = {
  linkId: string;
  linkOperations: TLinkOperationsModal;
  isNotAllowed: boolean;
  issueServiceType?: TIssueServiceType;
};

const getLinkHostname = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
};

export const IssueLinkItem = observer(function IssueLinkItem(props: TIssueLinkItem) {
  // props
  const { linkId, linkOperations, isNotAllowed, issueServiceType = EIssueServiceType.ISSUES } = props;
  // hooks
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  const {
    toggleIssueLinkModal: toggleIssueLinkModalStore,
    setIssueLinkData,
    link: { getLinkById },
  } = useIssueDetail(issueServiceType);
  const { isMobile } = usePlatformOS();
  const linkDetail = getLinkById(linkId);
  if (!linkDetail) return <></>;

  const faviconUrl: string | undefined = linkDetail.metadata?.favicon;
  const metadataTitle: string | undefined = linkDetail.metadata?.title;
  const customTitle = linkDetail.title?.trim();
  const displayTitle = customTitle || linkDetail.url;
  const secondaryMeta =
    (metadataTitle?.trim() && metadataTitle.trim() !== displayTitle ? metadataTitle.trim() : undefined) ||
    (customTitle ? getLinkHostname(linkDetail.url) : undefined) ||
    calculateTimeAgo(linkDetail.created_at);
  const creatorId = linkDetail.created_by_id ?? (linkDetail as { created_by?: string }).created_by;
  const creator = creatorId ? getUserDetails(creatorId) : undefined;
  const creatorName = creator?.display_name || creator?.first_name || "";

  const toggleIssueLinkModal = (modalToggle: boolean) => {
    toggleIssueLinkModalStore(modalToggle);
    setIssueLinkData(linkDetail);
  };

  return (
    <div
      key={linkId}
      className="group flex h-11 w-full min-w-0 items-center justify-between gap-3 px-3 hover:bg-surface-2"
    >
      <a
        href={linkDetail.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3 text-13"
      >
        <div className="flex size-[18px] shrink-0 items-center justify-center">
          {faviconUrl ? (
            <img src={faviconUrl} alt="" className="size-[18px] rounded-xs object-contain" />
          ) : (
            <LinkOutline className="size-[18px] text-tertiary group-hover:text-primary" />
          )}
        </div>
        <Tooltip label={linkDetail.url} layout="stacked" disabled={isMobile}>
          <p className="truncate font-medium text-secondary">{displayTitle}</p>
        </Tooltip>
        {secondaryMeta && (
          <>
            <span className="size-1.5 shrink-0 rounded-full bg-layer-3" />
            <span className="shrink-0 truncate text-placeholder">{secondaryMeta}</span>
          </>
        )}
      </a>

      <div className="flex shrink-0 items-center gap-3">
        {creatorId && (
          <Tooltip
            label={`${translate("web.added")} ${renderFormattedDate(linkDetail.created_at) ?? calculateTimeAgo(linkDetail.created_at)}${creatorName ? ` · ${creatorName}` : ""}`}
            layout="stacked"
            disabled={isMobile}
          >
            <div className="flex items-center justify-center">
              <ButtonAvatars showTooltip userIds={creatorId} />
            </div>
          </Tooltip>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            variant="ghost"
            size="sm"
            type="button"
            aria-label={t("common.actions.copy_link")}
            icon={<Copy className="size-3.5 stroke-[1.5]" />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void copyTextToClipboard(linkDetail.url);
              setToast({
                type: "success",
                title: t("common.link_copied"),
                message: t("common.link_copied_to_clipboard"),
              });
            }}
          />
          <Menu>
            {/* Icon-only trigger, so it needs an explicit accessible name. */}
            <MenuTrigger
              render={
                <IconButton
                  variant="ghost"
                  size="sm"
                  disabled={isNotAllowed}
                  aria-label={t("aria_labels.common.more_actions")}
                  icon={<Icon icon={MoreHorizontalOutline} />}
                />
              }
            />
            <MenuContent side="bottom" align="end">
              <MenuItem
                icon={<Icon icon={EditOutline} />}
                label={t("common.actions.edit")}
                onClick={() => {
                  toggleIssueLinkModal(true);
                }}
              />
              <MenuItem
                icon={<Icon icon={DeleteOutline} />}
                label={t("common.actions.delete")}
                onClick={() => {
                  void linkOperations.remove(linkDetail.id);
                }}
              />
            </MenuContent>
          </Menu>
        </div>
      </div>
    </div>
  );
});
