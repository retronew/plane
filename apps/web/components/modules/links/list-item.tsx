/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import { observer } from "mobx-react";

import { DeleteOutline, EditOutline } from "@makeplane/propel/icons";
import { Copy } from "lucide-react";
// plane types
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { ILinkDetails } from "@plane/types";
// plane ui
import { getIconForLink, copyTextToClipboard, calculateTimeAgo } from "@plane/utils";
// helpers
//
// hooks
import { useMember } from "@/hooks/store/use-member";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { translate } from "@plane/i18n";

type Props = {
  handleDeleteLink: () => void;
  handleEditLink: () => void;
  isEditingAllowed: boolean;
  link: ILinkDetails;
};

const copyToClipboard = (text: string) =>
  copyTextToClipboard(text).then(() =>
    setToast({
      type: "success",
      title: translate("web.copied_to_clipboard"),
      message: translate("web.the_url_has_been_successfully_copied_to_your_clipboard"),
    })
  );

export const ModulesLinksListItem = observer(function ModulesLinksListItem(props: Props) {
  const { handleDeleteLink, handleEditLink, isEditingAllowed, link } = props;
  // store hooks
  const { getUserDetails } = useMember();
  // derived values
  const createdByDetails = getUserDetails(link.created_by);
  // platform os
  const { isMobile } = usePlatformOS();

  const Icon = getIconForLink(link.url);

  return (
    <div className="relative flex flex-col rounded-md bg-layer-3 p-2.5">
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex items-start gap-2 truncate">
          <span className="py-1">
            <Icon className="size-3 shrink-0 stroke-2 text-tertiary group-hover:text-primary" />
          </span>
          <Tooltip label={link.title && link.title !== "" ? link.title : link.url} layout="stacked" disabled={isMobile}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer truncate text-11">
              {link.title && link.title !== "" ? link.title : link.url}
            </a>
          </Tooltip>
        </div>

        <div className="z-1 flex shrink-0 items-center">
          {isEditingAllowed && (
            <button
              type="button"
              aria-label={translate("edit")}
              className="grid place-items-center rounded-sm p-1 text-secondary hover:bg-layer-transparent-hover"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEditLink();
              }}
            >
              <EditOutline className="size-3 stroke-[1.5]" />
            </button>
          )}
          <button
            type="button"
            aria-label={translate("copy_link")}
            onClick={() => copyToClipboard(link.url)}
            className="grid place-items-center rounded-sm p-1 text-secondary hover:bg-layer-transparent-hover"
          >
            <Copy className="size-3 stroke-[1.5]" />
          </button>
          {isEditingAllowed && (
            <button
              type="button"
              aria-label={translate("delete")}
              className="grid place-items-center rounded-sm p-1 text-secondary hover:bg-layer-transparent-hover"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteLink();
              }}
            >
              <DeleteOutline className="size-3 stroke-[1.5]" />
            </button>
          )}
        </div>
      </div>
      <div className="px-5">
        <p className="mt-0.5 flex items-center gap-1.5 stroke-[1.5] text-11 text-tertiary">
          {translate("web.added")} {calculateTimeAgo(link.created_at)}{" "}
          {createdByDetails && (
            <>
              <Translation
                translationKey="web.ui.created_by"
                values={{
                  name: createdByDetails?.is_bot
                    ? translate("web.ui.bot_name", { name: createdByDetails?.first_name ?? "" })
                    : (createdByDetails?.display_name ?? ""),
                }}
              />
            </>
          )}
        </p>
      </div>
    </div>
  );
});
