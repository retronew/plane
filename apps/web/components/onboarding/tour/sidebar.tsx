/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { CyclesOutline, ModuleOutline, PagesOutline, ViewsOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import type { ISvgIcons } from "@plane/blocks/icons";
// types
import type { TTourSteps } from "./root";
import { translate } from "@plane/i18n";

const sidebarOptions: {
  key: TTourSteps;
  label: string;
  Icon: React.FC<ISvgIcons>;
}[] = [
  {
    key: "work-items",
    get label() {
      return translate("web.work_items_af8f");
    },
    Icon: WorkItemsOutline,
  },
  {
    key: "cycles",
    get label() {
      return translate("web.cycles");
    },
    Icon: CyclesOutline,
  },
  {
    key: "modules",
    get label() {
      return translate("web.title_modules");
    },
    Icon: ModuleOutline,
  },
  {
    key: "views",
    get label() {
      return translate("web.title_views");
    },
    Icon: ViewsOutline,
  },
  {
    key: "pages",
    get label() {
      return translate("web.title_pages");
    },
    Icon: PagesOutline,
  },
];

type Props = {
  step: TTourSteps;
  setStep: React.Dispatch<React.SetStateAction<TTourSteps>>;
};

export function TourSidebar({ step, setStep }: Props) {
  return (
    <div className="col-span-3 hidden bg-surface-2 p-8 lg:block">
      <h3 className="text-16 font-medium">
        {translate("web.lets_get_started")}
        <br />
        {translate("web.get_more_out_of_plane")}
      </h3>
      <div className="mt-8 space-y-5">
        {sidebarOptions.map((option) => (
          <button
            type="button"
            key={option.key}
            className={`flex cursor-pointer items-center gap-2 border-l-[3px] py-0.5 pr-2 pl-3 text-13 font-medium capitalize ${
              step === option.key ? "border-accent-strong text-accent-primary" : "border-transparent text-secondary"
            }`}
            onClick={() => setStep(option.key)}
          >
            <option.Icon className="h-4 w-4" aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
