/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import React from "react";
// components
import { ProjectLogo } from "@plane/blocks/emoji-icon-picker";
// plane imports
import type { TPartialProject } from "@plane/types";
// local imports
import { PowerKMenuBuilder } from "./builder";

type Props = {
  projects: TPartialProject[];
  onSelect: (project: TPartialProject) => void;
};

const renderProjectIcon = (project: TPartialProject) => (
  <span className="shrink-0">
    <ProjectLogo logo={project.logo_props} size={14} />
  </span>
);

export function PowerKProjectsMenu({ projects, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <PowerKMenuBuilder
      items={projects}
      getKey={(project) => project.id}
      getIconNode={renderProjectIcon}
      getValue={(project) => project.name}
      getLabel={(project) => project.name}
      onSelect={onSelect}
      emptyText={t("web.ui.no_projects")}
    />
  );
}
