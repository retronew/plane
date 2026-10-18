/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import React from "react";
import { observer } from "mobx-react";
// plane imports
import { ModuleStatusIcon } from "@plane/blocks/icons";
import type { IModule } from "@plane/types";
// local imports
import { PowerKMenuBuilder } from "./builder";

const getIconNode = (module: IModule) => (
  <ModuleStatusIcon status={module.status ?? "backlog"} className="size-3.5 shrink-0" />
);

type Props = {
  modules: IModule[];
  onSelect: (module: IModule) => void;
  value?: string[];
};

export const PowerKModulesMenu = observer(function PowerKModulesMenu({ modules, onSelect, value }: Props) {
  const { t } = useTranslation();
  return (
    <PowerKMenuBuilder
      items={modules}
      getKey={(module) => module.id}
      getIconNode={getIconNode}
      getValue={(module) => module.name}
      getLabel={(module) => module.name}
      isSelected={(module) => !!value?.includes(module.id)}
      onSelect={onSelect}
      emptyText={t("web.ui.no_modules")}
    />
  );
});
