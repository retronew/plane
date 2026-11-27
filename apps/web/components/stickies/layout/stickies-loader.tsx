/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane ui
import { Loader } from "@plane/blocks/skeleton";

export function StickiesLoader() {
  return (
    <Loader className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4 pb-2">
      {["sticky-one", "sticky-two", "sticky-three", "sticky-four"].map((id) => (
        <div key={id} className="space-y-4 rounded-xl border border-subtle bg-surface-1 p-4">
          <div className="space-y-2">
            <Loader.Item height="18px" />
            <Loader.Item height="14px" width="75%" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader.Item height="14px" width="14px" className="shrink-0" />
              <Loader.Item height="14px" width="100%" />
            </div>
            <div className="flex items-center gap-2">
              <Loader.Item height="14px" width="14px" className="shrink-0" />
              <Loader.Item height="14px" width="75%" />
            </div>
            <div className="flex items-center gap-2">
              <Loader.Item height="14px" width="14px" className="shrink-0" />
              <Loader.Item height="14px" width="85%" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <Loader.Item height="22px" width="22px" />
              <Loader.Item height="22px" width="22px" />
            </div>
            <Loader.Item height="22px" width="22px" className="shrink-0" />
          </div>
        </div>
      ))}
    </Loader>
  );
}
