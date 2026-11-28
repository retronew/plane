/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { Loader } from "@plane/blocks/skeleton";
import { translate } from "@plane/i18n";

export function ProjectDetailsFormLoader() {
  return (
    <Loader className="w-full">
      <div className="relative mt-6 h-44 w-full overflow-hidden rounded-lg">
        <Loader.Item height="100%" width="100%" className="rounded-lg" />
        <div className="absolute bottom-4 flex w-full items-end justify-between gap-3 px-4">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-surface-1 p-1">
            <Loader.Item height="44px" width="44px" />
          </div>
          <Loader.Item height="32px" width="108px" className="bg-surface-1/80" />
        </div>
      </div>
      <div className="my-8 flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <h4 className="text-13">{translate("web.project_name")}</h4>
          <Loader.Item height="42px" width="100%" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 className="text-13">{translate("web.description")}</h4>
          <Loader.Item height="102px" width="100%" />
        </div>
        <div className="flex w-full items-center justify-between gap-10">
          <div className="flex w-1/2 flex-col gap-1.5">
            <h4 className="text-13">{translate("web.identifier")}</h4>
            <Loader.Item height="38px" width="100%" />
          </div>
          <div className="flex w-1/2 flex-col gap-1.5">
            <h4 className="text-13">{translate("web.network")}</h4>
            <Loader.Item height="38px" width="100%" />
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <Loader.Item height="34px" width="100px" />
        </div>
      </div>
    </Loader>
  );
}
