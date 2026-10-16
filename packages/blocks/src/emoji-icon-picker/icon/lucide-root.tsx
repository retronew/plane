import { useTranslation } from "@plane/i18n";
import { matchesIconSearch } from "../search";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { LUCIDE_ICONS_LIST } from "../lucide-icons";

type LucideIconsListProps = {
  onChange: (value: { name: string; color: string }) => void;
  activeColor: string;
  query: string;
};

export function LucideIconsList(props: LucideIconsListProps) {
  const { query, onChange, activeColor } = props;
  const { t } = useTranslation();

  const filteredArray = LUCIDE_ICONS_LIST.filter((icon) => matchesIconSearch(icon.name, query));

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
          <icon.element aria-hidden="true" style={{ color: activeColor }} className="size-4" />
        </button>
      ))}
    </>
  );
}
