/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Code2, type LucideIcon } from "lucide-react";
import {
  CyclesOutline,
  EstimateOutline,
  IntakeOutline,
  LabelsOutline,
  MembersOutline,
  ModuleOutline,
  PagesOutline,
  SettingsOutline,
  StateOutline,
  TemplatesOutline,
  TriggerOutline,
  ViewsOutline,
  WorkflowsOutline,
  WorkItemsOutline,
} from "@makeplane/propel/icons";
// plane imports
import type { ISvgIcons } from "@plane/blocks/icons";
import type { TProjectSettingsTabs } from "@plane/types";

export const PROJECT_SETTINGS_ICONS: Record<TProjectSettingsTabs, LucideIcon | React.FC<ISvgIcons>> = {
  general: SettingsOutline,
  members: MembersOutline,
  features_cycles: CyclesOutline,
  features_modules: ModuleOutline,
  features_views: ViewsOutline,
  features_pages: PagesOutline,
  features_intake: IntakeOutline,
  issue_types: WorkItemsOutline,
  templates: TemplatesOutline,
  states: StateOutline,
  labels: LabelsOutline,
  estimates: EstimateOutline,
  automations: TriggerOutline,
  workflows: WorkflowsOutline,
  workflow_runner: Code2,
};
