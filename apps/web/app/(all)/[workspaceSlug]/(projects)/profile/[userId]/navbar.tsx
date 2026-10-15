/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams, usePathname } from "next/navigation";
// plane imports
import { PROFILE_VIEWER_TAB, PROFILE_ADMINS_TAB } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { TabsList } from "@makeplane/propel/components/tabs";
import { AnimatedUnderlineTabs } from "@/components/navigation/animated-underline-tabs";
import { UnderlineTabLink } from "@/components/navigation/underline-tab-link";

type Props = {
  isAuthorized: boolean;
};

export function ProfileNavbar(props: Props) {
  const { isAuthorized } = props;
  const { t } = useTranslation();
  const { workspaceSlug, userId } = useParams();
  const pathname = usePathname();

  const tabsList = isAuthorized ? [...PROFILE_VIEWER_TAB, ...PROFILE_ADMINS_TAB] : PROFILE_VIEWER_TAB;

  const basePath = `/${workspaceSlug}/profile/${userId}`;
  const activeTab =
    tabsList.find((tab) => pathname.replace(/\/$/, "") === `${basePath}/${tab.route}`.replace(/\/$/, ""))?.key ??
    "summary";

  return (
    <Header
      variant={EHeaderVariant.SECONDARY}
      showOnMobile={false}
      setHeight={false}
      className="h-12 shrink-0 items-center"
    >
      <AnimatedUnderlineTabs fillHeight value={activeTab} motionKey={basePath}>
        <TabsList>
          {tabsList.map((tab) => (
            <UnderlineTabLink
              key={tab.key}
              value={tab.key}
              label={t(tab.i18n_label)}
              to={`${basePath}/${tab.route}${tab.route ? "/" : ""}`}
            />
          ))}
        </TabsList>
      </AnimatedUnderlineTabs>
    </Header>
  );
}
