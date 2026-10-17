/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { TabsList } from "@makeplane/propel/components/tabs";
// types
import type { TPageNavigationTabs } from "@plane/types";
// helpers
import { translate } from "@plane/i18n";
// components
import { AnimatedUnderlineTabs } from "@/components/navigation/animated-underline-tabs";
import { UnderlineTabLink } from "@/components/navigation/underline-tab-link";

type TPageTabNavigation = {
  workspaceSlug: string;
  projectId: string;
  pageType: TPageNavigationTabs;
};

// pages tab options
const pageTabs: { key: TPageNavigationTabs; label: string }[] = [
  {
    key: "public",
    get label() {
      return translate("web.public");
    },
  },
  {
    key: "private",
    get label() {
      return translate("web.private");
    },
  },
  {
    key: "archived",
    get label() {
      return translate("web.archived");
    },
  },
];

export function PageTabNavigation(props: TPageTabNavigation) {
  const { workspaceSlug, projectId, pageType } = props;

  const handleTabClick = (e: React.MouseEvent<HTMLAnchorElement>, tabKey: TPageNavigationTabs) => {
    if (tabKey === pageType) e.preventDefault();
  };

  return (
    <AnimatedUnderlineTabs fillHeight value={pageType} motionKey={`/${workspaceSlug}/projects/${projectId}/pages`}>
      <TabsList>
        {pageTabs.map((tab) => (
          <UnderlineTabLink
            key={tab.key}
            value={tab.key}
            label={tab.label}
            to={`/${workspaceSlug}/projects/${projectId}/pages?type=${tab.key}`}
            linkProps={{ onClick: (e) => handleTabClick(e, tab.key) }}
          />
        ))}
      </TabsList>
    </AnimatedUnderlineTabs>
  );
}
