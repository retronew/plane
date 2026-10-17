/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { GlobeOutline, LockOutline } from "@makeplane/propel/icons";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { FavoriteStar } from "@plane/blocks/common";
import { getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { usePageOperations } from "@/hooks/use-page-operations";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";
// local imports
import { PageActions } from "../dropdowns";
import { PageLabels } from "./page-labels";
import { translate } from "@plane/i18n";

type Props = {
  page: TPageInstance;
  parentRef: React.RefObject<HTMLElement | null>;
  storeType: EPageStoreType;
};

export const BlockItemAction = observer(function BlockItemAction(props: Props) {
  const { page, parentRef, storeType } = props;
  // store hooks
  const { getUserDetails } = useMember();
  const { workspaceSlug } = useParams();
  // page operations
  const { pageOperations } = usePageOperations({
    page,
  });
  // derived values
  const { access, is_favorite, owned_by, canCurrentUserFavoritePage } = page;
  const ownerDetails = owned_by ? getUserDetails(owned_by) : undefined;
  const ownerAvatar = (
    <Avatar
      alt={ownerDetails?.display_name}
      fallback={ownerDetails?.display_name?.[0]?.toUpperCase()}
      src={getFileURL(ownerDetails?.avatar_url ?? "")}
      size="2xs"
    />
  );

  return (
    <>
      <PageLabels page={page} />
      {/* page details */}
      <Tooltip label={access === 0 ? translate("web.public") : translate("web.private")}>
        <span className="grid size-6 cursor-default place-items-center text-secondary">
          {access === 0 ? <GlobeOutline className="size-3.5" /> : <LockOutline className="size-3.5" />}
        </span>
      </Tooltip>
      <div className="grid size-6 cursor-default place-items-center">
        <Tooltip label={translate("web.runtime.owned_by", { name: ownerDetails?.display_name ?? "" })} layout="stacked">
          {owned_by && workspaceSlug ? (
            <Link
              href={`/${workspaceSlug}/profile/${owned_by}/`}
              aria-label={translate("web.runtime.owned_by", { name: ownerDetails?.display_name ?? "" })}
              className="grid size-6 place-items-center rounded-sm focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
              onClick={(event) => event.stopPropagation()}
            >
              {ownerAvatar}
            </Link>
          ) : (
            <span className="grid size-6 place-items-center">{ownerAvatar}</span>
          )}
        </Tooltip>
      </div>
      {/* favorite/unfavorite */}
      {canCurrentUserFavoritePage && (
        <FavoriteStar
          buttonClassName="size-6 rounded-sm hover:bg-layer-transparent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
          iconClassName={`size-3.5 ${is_favorite ? "text-[#fbbf24]" : "text-secondary"}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            pageOperations.toggleFavorite();
          }}
          selected={is_favorite}
        />
      )}

      {/* quick actions dropdown */}
      <PageActions
        optionsOrder={[
          "open-in-new-tab",
          "copy-link",
          "make-a-copy",
          "move",
          "toggle-lock",
          "toggle-access",
          "archive-restore",
          "delete",
        ]}
        page={page}
        parentRef={parentRef}
        storeType={storeType}
      />
    </>
  );
});
