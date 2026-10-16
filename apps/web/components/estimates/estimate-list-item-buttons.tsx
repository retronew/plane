/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { observer } from "mobx-react";
import { Trash2 } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";

type Props = {
  estimateId: string;
  isAdmin: boolean;
  isEstimateEnabled: boolean;
  isEditable: boolean;
  onEditClick?: (estimateId: string) => void;
  onDeleteClick?: (estimateId: string) => void;
};
export const EstimateListItemButtons = observer(function EstimateListItemButtons({
  estimateId,
  isAdmin,
  isEditable,
  onDeleteClick,
}: Props) {
  const { t } = useTranslation();
  if (!isAdmin || !isEditable) return null;
  return (
    <Tooltip label={t("delete")}>
      <IconButton
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("delete")}
        icon={<Trash2 className="size-3.5" />}
        onClick={() => onDeleteClick?.(estimateId)}
      />
    </Tooltip>
  );
});
