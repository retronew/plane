/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
// assets
import darkAssetsAsset from "@/app/assets/empty-state/wiki/navigation-pane/assets-dark.webp?url";
import lightAssetsAsset from "@/app/assets/empty-state/wiki/navigation-pane/assets-light.webp?url";
// local imports
import { PageNavigationPaneEmptyState } from "./empty-state";

export function PageNavigationPaneAssetsTabEmptyState() {
  const { t } = useTranslation();

  return (
    <PageNavigationPaneEmptyState
      lightImage={lightAssetsAsset}
      darkImage={darkAssetsAsset}
      imageAlt={t("web.depicts_the_assets_of_a_page")}
      title={t("page_navigation_pane.tabs.assets.empty_state.title")}
      description={t("page_navigation_pane.tabs.assets.empty_state.description")}
    />
  );
}
