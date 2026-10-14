/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { IconButton } from "@makeplane/propel/components/icon-button";

import { Header } from "@plane/blocks/layout";
// components

// local imports
import { NotificationSidebarHeaderOptions } from "./options";

type TNotificationSidebarHeader = {
  workspaceSlug: string;
};

export const NotificationSidebarHeader = observer(function NotificationSidebarHeader(
  props: TNotificationSidebarHeader
) {
  const { workspaceSlug } = props;
  const { t } = useTranslation();
  const router = useRouter();

  if (!workspaceSlug) return <></>;
  return (
    <Header className="my-auto bg-surface-1 px-0">
      <Header.LeftItem>
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            variant="ghost"
            icon={<ArrowLeft className="size-3.5" />}
            aria-label={t("common.back")}
            onClick={() => router.push(`/${workspaceSlug}/`)}
          />
          <h1 className="text-h5-semibold">{t("notification.label")}</h1>
        </div>
      </Header.LeftItem>
      <Header.RightItem>
        <NotificationSidebarHeaderOptions workspaceSlug={workspaceSlug} />
      </Header.RightItem>
    </Header>
  );
});
