/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { AddOutline } from "@makeplane/propel/icons";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
// plane imports
import { translate } from "@plane/i18n";
import type { TIssueServiceType } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  customButton?: React.ReactElement<React.ComponentPropsWithRef<"button">>;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

export const IssueLinksActionButton = observer(function IssueLinksActionButton(props: Props) {
  const { customButton, disabled = false, issueServiceType } = props;
  // store hooks
  const { toggleIssueLinkModal } = useIssueDetail(issueServiceType);

  // handlers
  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleIssueLinkModal(true);
  };

  if (customButton) {
    return React.cloneElement(customButton, {
      disabled: disabled || customButton.props.disabled,
      onClick: (event) => {
        event.stopPropagation();
        customButton.props.onClick?.(event);
        if (!event.defaultPrevented && !disabled) {
          event.preventDefault();
          toggleIssueLinkModal(true);
        }
      },
    });
  }

  return (
    <IconButton
      variant="ghost"
      size="sm"
      icon={<Icon icon={AddOutline} />}
      onClick={handleOnClick}
      type="button"
      aria-label={translate("issue.add.link")}
      disabled={disabled}
    />
  );
});
