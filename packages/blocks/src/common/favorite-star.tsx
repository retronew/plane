/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { StarFilled, StarOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
// helpers
import { cn } from "@plane/utils";

type Props = {
  /** Accessible name for the icon-only toggle; defaults to the translated "Add to favorites". */
  "aria-label"?: string;
  buttonClassName?: string;
  iconClassName?: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  selected: boolean;
};

/** Shared glyph for favorite toggles and menu actions. */
export function FavoriteStarIcon({ selected, className }: { selected: boolean; className?: string }) {
  const Icon = selected ? StarFilled : StarOutline;
  return (
    <Icon aria-hidden="true" className={cn("h-4 w-4", selected ? "text-[#fbbf24]" : "text-secondary", className)} />
  );
}

export function FavoriteStar(props: Props) {
  const { "aria-label": ariaLabel, buttonClassName, iconClassName, onClick, selected } = props;
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={cn("grid h-4 w-4 place-items-center", buttonClassName)}
      onClick={onClick}
      aria-label={ariaLabel ?? t("add_to_favorites")}
      aria-pressed={selected}
    >
      <FavoriteStarIcon
        selected={false}
        className={cn(
          "col-start-1 row-start-1 transition-opacity motion-reduce:transition-none",
          iconClassName,
          selected ? "opacity-0" : "opacity-100"
        )}
      />
      <FavoriteStarIcon
        selected
        className={cn(
          "col-start-1 row-start-1 transition-opacity motion-reduce:transition-none",
          iconClassName,
          selected ? "opacity-100" : "opacity-0"
        )}
      />
    </button>
  );
}
