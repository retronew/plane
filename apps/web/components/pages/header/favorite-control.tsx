/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { FavoriteStar } from "@plane/blocks/common";
// hooks
import { usePageOperations } from "@/hooks/use-page-operations";
// store
import type { TPageInstance } from "@/store/pages/base-page";
import { translate } from "@plane/i18n";

type Props = {
  page: TPageInstance;
};

export const PageFavoriteControl = observer(function PageFavoriteControl({ page }: Props) {
  // derived values
  const { is_favorite, canCurrentUserFavoritePage } = page;
  // page operations
  const { pageOperations } = usePageOperations({
    page,
  });

  if (!canCurrentUserFavoritePage) return null;

  return (
    <FavoriteStar
      selected={is_favorite}
      buttonClassName="size-7 rounded-sm hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
      iconClassName="size-4"
      onClick={() => pageOperations.toggleFavorite()}
      aria-label={is_favorite ? translate("web.remove_favorite") : translate("web.add_to_favorites")}
    />
  );
});
