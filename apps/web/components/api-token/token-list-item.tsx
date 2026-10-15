import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useState } from "react";
import { DeleteOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuTrigger, MenuItem } from "@makeplane/propel/components/menu";
import type { IApiToken } from "@plane/types";
import { renderFormattedDate, renderFormattedTime, calculateTimeAgo } from "@plane/utils";
import { translate } from "@plane/i18n";
import { DeleteApiTokenModal } from "@/components/api-token/delete-token-modal";

type Props = { token: IApiToken; workspaceSlug?: string };

export function ApiTokenListItem({ token, workspaceSlug }: Props) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  return (
    <tr className="border-b border-subtle last:border-0 hover:bg-layer-1-hover">
      <td className="min-w-0 px-3 py-3">
        <div className="truncate text-body-xs-medium text-primary" title={token.description || token.label}>
          {token.label}
        </div>
        {token.scope === "read" && (
          <span className="text-caption-sm-regular text-secondary">
            {translate("workspace_settings.settings.api_tokens.read_only")}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={token.is_active ? "text-success-primary" : "text-secondary"}>
          {token.is_active ? translate("web.active") : translate("web.expired")}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-secondary">{renderFormattedDate(token.created_at)}</td>
      <td className="px-3 py-3 whitespace-nowrap text-secondary">
        {token.expired_at ? renderFormattedDate(token.expired_at) : translate("web.never_expires")}
      </td>
      <td
        className="px-3 py-3 text-secondary"
        title={
          token.last_used
            ? `${renderFormattedDate(token.last_used)} ${renderFormattedTime(token.last_used)}`
            : undefined
        }
      >
        {token.last_used ? calculateTimeAgo(token.last_used) : translate("web.token_never_used")}
      </td>
      <td className="px-2 py-2 text-right">
        <Menu>
          <MenuTrigger
            render={
              <IconButton
                variant="ghost"
                size="sm"
                icon={<Icon icon={MoreHorizontalOutline} />}
                aria-label={translate("common.options")}
              />
            }
          />
          <MenuContent side="bottom" align="end" sizing="anchor">
            <div className="w-32">
              <MenuItem
                variant="danger"
                icon={<Icon icon={DeleteOutline} />}
                label={translate("web.delete_token")}
                onClick={() => setDeleteModalOpen(true)}
              />
            </div>
          </MenuContent>
        </Menu>
        <DeleteApiTokenModal
          workspaceSlug={workspaceSlug}
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          tokenId={token.id}
        />
      </td>
    </tr>
  );
}
