/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { EIssuesStoreType } from "@plane/types";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useUserPermissions } from "@/hooks/store/user";
import { translate } from "@plane/i18n";

export const ProjectViewEmptyState = observer(function ProjectViewEmptyState() {
  // store hooks
  const { toggleCreateIssueModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();

  // auth
  const isCreatingIssueAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  return (
    // TODO: Add translation
    <EmptyStateDetailed
      assetKey="work-item"
      title={translate("web.view_work_items_will_appear_here")}
      description={translate("web.work_items_help_you_track_individual_pieces_of_work_with_wor")}
      actions={[
        {
          label: translate("web.new_work_item"),
          onClick: () => {
            toggleCreateIssueModal(true, EIssuesStoreType.PROJECT_VIEW);
          },
          disabled: !isCreatingIssueAllowed,
          variant: "primary",
        },
      ]}
    />
  );
});
