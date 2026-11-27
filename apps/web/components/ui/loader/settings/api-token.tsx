/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";
import { useTranslation } from "@plane/i18n";

export function APITokenSettingsLoader() {
  const { t } = useTranslation();
  return (
    <section className="w-full overflow-y-auto">
      <div className="mb-2 flex items-center justify-between border-b border-subtle pb-3.5">
        <h3 className="text-18 font-medium">{t("workspace_settings.settings.api_tokens.title")}</h3>
        <div className="h-8 w-28 rounded-sm bg-layer-3 motion-safe:animate-pulse" />
      </div>
      <div className="divide-y-[0.5px] divide-subtle-1 motion-safe:animate-pulse">
        {range(4).map((i) => (
          <div key={i} className="grid grid-cols-6 items-center gap-4 py-3.5">
            <div className="col-span-2 flex flex-col gap-1.5">
              <div className="h-4 w-36 rounded-sm bg-layer-3" />
              <div className="h-3 w-24 rounded-sm bg-layer-3" />
            </div>
            <div className="h-4 w-20 rounded-sm bg-layer-3" />
            <div className="h-4 w-24 rounded-sm bg-layer-3" />
            <div className="h-4 w-16 rounded-sm bg-layer-3" />
            <div className="ml-auto h-6 w-16 rounded-sm bg-layer-3" />
          </div>
        ))}
      </div>
    </section>
  );
}
