/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { WorkspaceSettingsSidebarToggle } from "./workspace/sidebar/collapse";
import { Header } from "@plane/blocks/layout";

type Props = {
  leftItem?: React.ReactNode;
  rightItem?: React.ReactNode;
};

export function SettingsPageHeader(props: Props) {
  const { leftItem, rightItem } = props;

  return (
    <Header>
      <Header.LeftItem>
        <WorkspaceSettingsSidebarToggle onlyWhenCollapsed />
        {leftItem}
      </Header.LeftItem>
      {rightItem && <Header.RightItem>{rightItem}</Header.RightItem>}
    </Header>
  );
}
