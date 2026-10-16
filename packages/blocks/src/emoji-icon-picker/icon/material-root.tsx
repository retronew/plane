import { useTranslation } from "@plane/i18n";
import { matchesIconSearch } from "../search";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useFontFaceObserver from "use-font-face-observer";
import { MATERIAL_ICONS_LIST } from "../material-icons";

type MaterialIconListProps = {
  onChange: (value: { name: string; color: string }) => void;
  activeColor: string;
  query: string;
};

export function MaterialIconList(props: MaterialIconListProps) {
  const { query, onChange, activeColor } = props;
  const { t } = useTranslation();

  const filteredArray = MATERIAL_ICONS_LIST.filter((icon) => matchesIconSearch(icon.name, query));

  const isMaterialSymbolsFontLoaded = useFontFaceObserver([
    {
      family: `Material Symbols Rounded`,
      style: `normal`,
      weight: `normal`,
      stretch: `condensed`,
    },
  ]);

  return (
    <>
      {filteredArray.length === 0 && (
        <output className="col-span-full py-8 text-center text-13 text-tertiary">{t("web.no_results_found")}</output>
      )}
      {filteredArray.map((icon) => (
        <button
          key={icon.name}
          type="button"
          data-icon-picker-choice=""
          style={{ color: activeColor }}
          aria-label={icon.name}
          title={icon.name.replace(/_/g, " ")}
          className="grid size-7 place-items-center rounded-md text-body-md-regular outline-none select-none hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong"
          onClick={() => {
            onChange({
              name: icon.name,
              color: activeColor,
            });
          }}
        >
          {isMaterialSymbolsFontLoaded ? (
            <span style={{ color: activeColor }} className="material-symbols-rounded text-18! leading-none!">
              {icon.name}
            </span>
          ) : (
            <span className="size-5 animate-pulse rounded-sm bg-layer-1" />
          )}
        </button>
      ))}
    </>
  );
}
