/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
// assets
import darkOutlineAsset from "@/app/assets/empty-state/wiki/navigation-pane/outline-dark.webp?url";
import lightOutlineAsset from "@/app/assets/empty-state/wiki/navigation-pane/outline-light.webp?url";
// local imports
import { PageNavigationPaneEmptyState } from "./empty-state";

export function PageNavigationPaneOutlineTabEmptyState() {
  const { t } = useTranslation();

  return (
    <PageNavigationPaneEmptyState
      lightImage={lightOutlineAsset}
      darkImage={darkOutlineAsset}
      imageAlt={t("web.depicts_the_outline_of_a_page")}
      title={t("page_navigation_pane.tabs.outline.empty_state.title")}
      description={t("page_navigation_pane.tabs.outline.empty_state.description")}
    />
  );
}
