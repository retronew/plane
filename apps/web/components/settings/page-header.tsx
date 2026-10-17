/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsSidebarToggle } from "./sidebar/collapse";

type Props = {
  breadcrumbs?: { label: string; icon?: React.ReactNode; href?: string }[];
  leftItem?: React.ReactNode;
  rightItem?: React.ReactNode;
};

export function SettingsPageHeader(props: Props) {
  const { breadcrumbs, leftItem, rightItem } = props;

  return (
    <Header>
      <Header.LeftItem>
        <SettingsSidebarToggle onlyWhenCollapsed />
        {breadcrumbs && (
          <Breadcrumbs>
            {breadcrumbs.map((breadcrumb, index) => (
              <Breadcrumbs.Item
                key={breadcrumb.href ?? breadcrumb.label}
                component={<BreadcrumbLink {...breadcrumb} isLast={index === breadcrumbs.length - 1} />}
              />
            ))}
          </Breadcrumbs>
        )}
        {leftItem}
      </Header.LeftItem>
      {rightItem && <Header.RightItem>{rightItem}</Header.RightItem>}
    </Header>
  );
}
