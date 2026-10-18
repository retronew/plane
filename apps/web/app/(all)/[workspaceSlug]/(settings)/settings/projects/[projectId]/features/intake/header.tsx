/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { PROJECT_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// components
import { PROJECT_SETTINGS_ICONS } from "@/components/settings/project/sidebar/item-icon";
import { SettingsBreadcrumbHeader } from "@/components/settings/settings-breadcrumb-header";

export const FeaturesIntakeProjectSettingsHeader = observer(function FeaturesIntakeProjectSettingsHeader() {
  // translation
  const { t } = useTranslation();
  // derived values
  const settingsDetails = PROJECT_SETTINGS.features_intake;
  const Icon = PROJECT_SETTINGS_ICONS.features_intake;

  return <SettingsBreadcrumbHeader label={t(settingsDetails.i18n_label)} icon={Icon} />;
});
