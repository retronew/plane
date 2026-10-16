/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { setPromiseToast } from "@plane/blocks/toast";
import type { IProject } from "@plane/types";
import { Switch } from "@makeplane/propel/components/switch";
// components
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { translate } from "@plane/i18n";

type Props = {
  description?: React.ReactNode;
  disabled?: boolean;
  projectId: string;
  featureProperty: keyof IProject;
  title: React.ReactNode;
  value: boolean;
  workspaceSlug: string;
};

export const ProjectSettingsFeatureControlItem = observer(function ProjectSettingsFeatureControlItem(props: Props) {
  const { description, disabled, featureProperty, projectId, title, value, workspaceSlug } = props;
  // store hooks
  const { getProjectById, updateProject } = useProject();
  // derived values
  const currentProjectDetails = getProjectById(projectId);

  const handleSubmit = () => {
    if (!workspaceSlug || !projectId || !currentProjectDetails) return;

    // making the request to update the project feature
    const settingsPayload = {
      [featureProperty]: !currentProjectDetails?.[featureProperty],
    };
    const updateProjectPromise = updateProject(workspaceSlug, projectId, settingsPayload);

    setPromiseToast(updateProjectPromise, {
      loading: translate("web.updating_project_feature"),
      success: {
        title: translate("toast.success"),
        message: () => translate("web.project_feature_updated"),
      },
      error: {
        title: translate("toast.error"),
        message: () => translate("web.project_feature_update_failed"),
      },
    });
    void updateProjectPromise.then(() => {
      return undefined;
    });
  };

  return (
    <SettingsBoxedControlItem
      title={title}
      description={description}
      control={
        <Switch
          size="md"
          checked={value}
          onCheckedChange={handleSubmit}
          disabled={disabled}
          aria-label={typeof title === "string" ? title : translate("web.toggle_project_feature")}
        />
      }
    />
  );
});
