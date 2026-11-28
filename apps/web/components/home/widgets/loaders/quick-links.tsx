/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";
// ui
import { Loader } from "@plane/blocks/skeleton";

export function QuickLinksWidgetLoader() {
  return (
    <Loader className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {range(3).map((index) => (
        <div key={index} className="flex h-14 items-center gap-3 rounded-xl border border-subtle bg-surface-1 p-3">
          <Loader.Item height="28px" width="28px" className="shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Loader.Item height="13px" width="75%" />
            <Loader.Item height="10px" width="45%" />
          </div>
        </div>
      ))}
    </Loader>
  );
}
