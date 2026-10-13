/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
// hooks
import useOnlineStatus from "@/hooks/use-online-status";
// store
import type { TPageInstance } from "@/store/pages/base-page";
import { translate } from "@plane/i18n";

type Props = {
  page: TPageInstance;
};

export const PageOfflineBadge = observer(function PageOfflineBadge({ page }: Props) {
  // use online status
  const { isOnline } = useOnlineStatus();

  if (!page.isContentEditable || isOnline) return null;

  return (
    <Tooltip label={translate("web.you_are_offline_you_can_continue_making_changes_they_will_be")} layout="stacked">
      <div className="flex h-7 flex-shrink-0 items-center gap-2 rounded-full bg-layer-1 px-3 py-0.5 text-11 font-medium text-tertiary">
        <span className="size-1.5 flex-shrink-0 rounded-full bg-layer-1" />
        <span>{translate("web.offline")}</span>
      </div>
    </Tooltip>
  );
});
