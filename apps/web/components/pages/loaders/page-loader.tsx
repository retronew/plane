/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { range } from "lodash-es";
import { Loader } from "@plane/blocks/skeleton";

export function PageLoader() {
  return (
    <Loader className="relative flex h-full w-full flex-col">
      {range(10).map((i) => (
        <div key={i} className="relative flex items-center gap-3 border-b border-subtle px-5 py-3.5">
          <Loader.Item width="18px" height="18px" className="shrink-0" />
          <Loader.Item width={`${220 + 18 * ((i * 7) % 10)}px`} height="18px" />
          <div className="relative ml-auto flex items-center gap-2">
            <Loader.Item width="64px" height="20px" />
            <Loader.Item width="22px" height="22px" className="rounded-full" />
            <Loader.Item width="22px" height="22px" />
          </div>
        </div>
      ))}
    </Loader>
  );
}
