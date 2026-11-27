/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";
import { translate } from "@plane/i18n";

export function WebhookSettingsLoader() {
  return (
    <div className="h-full w-full overflow-hidden py-8 pr-9">
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-subtle pb-3.5">
          <div className="text-18 font-medium">{translate("web.webhooks")}</div>
          <div className="h-8 w-28 rounded-sm bg-layer-3 motion-safe:animate-pulse" />
        </div>
        <div className="h-full w-full divide-y divide-subtle overflow-y-auto motion-safe:animate-pulse">
          {range(4).map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-3.5 py-[18px]">
              <div className="h-4 w-56 rounded-sm bg-layer-3" />
              <div className="h-6 w-12 rounded-full bg-layer-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
