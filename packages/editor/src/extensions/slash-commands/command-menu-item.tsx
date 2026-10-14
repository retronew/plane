/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane utils
import { cn } from "@plane/utils";
// types
import type { ISlashCommandItem } from "@/types";

type Props = {
  isSelected: boolean;
  item: ISlashCommandItem;
  itemIndex: number;
  onClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onMouseEnter: () => void;
  sectionIndex: number;
  query?: string;
  separatorBefore?: boolean;
};

// Utility to highlight matched text in a string
const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query || query.trim() === "") return text;

  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase();

  // Check for direct substring match
  const index = textLower.indexOf(queryLower);
  if (index >= 0) {
    const before = text.substring(0, index);
    const match = text.substring(index, index + queryLower.length);
    const after = text.substring(index + queryLower.length);

    return (
      <>
        {before}
        <span className="font-medium text-primary">{match}</span>
        {after}
      </>
    );
  }

  // Otherwise just return the text
  return text;
};

export function CommandMenuItem(props: Props) {
  const { isSelected, item, itemIndex, onClick, onMouseEnter, sectionIndex, query, separatorBefore = false } = props;

  return (
    <div className={cn({ "mt-1 border-t border-subtle-1 pt-1": separatorBefore })}>
      <button
        type="button"
        id={`item-${sectionIndex}-${itemIndex}`}
        data-selected={isSelected || undefined}
        className={cn(
          "flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-body-xs-regular text-primary transition-colors outline-none hover:bg-layer-transparent-hover focus-visible:bg-layer-transparent-hover",
          {
            "bg-layer-transparent-hover": isSelected,
          }
        )}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
      >
        <span
          aria-hidden="true"
          className="grid size-4 shrink-0 place-items-center text-secondary [&>svg]:size-4"
          style={item.iconContainerStyle}
        >
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{query ? highlightMatch(item.title, query) : item.title}</span>
        {item.badge}
      </button>
    </div>
  );
}
