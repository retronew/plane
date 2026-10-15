/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import { ProfileIssuesPage } from "@/components/profile/profile-issues";
import type { Route } from "./+types/page";

const ProfilePageHeader = {
  assigned: "profile.tabs.assigned",
  created: "profile.tabs.created",
  subscribed: "profile.tabs.subscribed",
};

function isValidProfileViewId(viewId: string): viewId is keyof typeof ProfilePageHeader {
  return viewId in ProfilePageHeader;
}

function ProfileIssuesTypePage({ params }: Route.ComponentProps) {
  const { profileViewId } = params;
  const { t } = useTranslation();

  if (!isValidProfileViewId(profileViewId)) return null;

  const header = t("profile.page_title", { tab: t(ProfilePageHeader[profileViewId]) });

  return (
    <>
      <PageHead title={header} />
      <ProfileIssuesPage type={profileViewId} />
    </>
  );
}

export default ProfileIssuesTypePage;
