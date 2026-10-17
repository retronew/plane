/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CloudOff, Dot } from "lucide-react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Badge } from "@makeplane/propel/components/badge";
import { useTranslation } from "@plane/i18n";

type Props = {
  syncStatus: "syncing" | "synced" | "error";
};

export function PageSyncingBadge({ syncStatus }: Props) {
  const { t } = useTranslation();
  if (syncStatus === "synced") return null;

  const label = syncStatus === "syncing" ? t("web.syncing") : t("web.connection_lost");
  const tooltipLabel =
    syncStatus === "syncing"
      ? t("web.ui.page_syncing_tooltip")
      : t("web.ui.page_connection_lost_tooltip", { seconds: 10 });

  return (
    <Tooltip label={tooltipLabel} layout="stacked">
      <span className="animate-quickFadeIn">
        <Badge
          variant={syncStatus === "syncing" ? "brand" : "danger"}
          size="sm"
          startIcon={syncStatus === "syncing" ? <Dot className="size-4" /> : <CloudOff className="size-4" />}
          label={label}
        />
      </span>
    </Tooltip>
  );
}
