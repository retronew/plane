/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Banner } from "@makeplane/propel/components/banner";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { TransferWorkItemOutline, WarningCircleOutline } from "@makeplane/propel/icons";
import { translate } from "@plane/i18n";

type Props = {
  handleClick: () => void;
  canTransferIssues?: boolean;
  disabled?: boolean;
};

export function TransferIssues(props: Props) {
  const { handleClick, canTransferIssues = false, disabled = false } = props;
  return (
    <Banner
      placement="page"
      variant="neutral"
      icon={<Icon icon={WarningCircleOutline} />}
      title={translate("web.completed_cycles_are_not_editable")}
      actions={
        canTransferIssues ? (
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            icon={<Icon icon={TransferWorkItemOutline} />}
            iconPosition="start"
            onClick={handleClick}
            disabled={disabled}
            label={translate("web.transfer_work_items")}
          />
        ) : undefined
      }
    />
  );
}
