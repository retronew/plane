/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// ui
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ControlLink, Row } from "@plane/blocks/layout";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";

interface IListItemProps {
  id?: string;
  compact?: boolean;
  fullRowLink?: boolean;
  title: string;
  itemLink: string;
  onItemClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  leadingElement?: React.ReactNode;
  prependTitleElement?: React.ReactNode;
  prependTitleTooltip?: string;
  appendTitleElement?: React.ReactNode;
  appendTitleTooltip?: string;
  actionableItems?: React.ReactNode;
  isMobile?: boolean;
  parentRef: React.RefObject<HTMLDivElement | null>;
  disableLink?: boolean;
  className?: string;
  itemClassName?: string;
  titleClassName?: string;
  actionItemContainerClassName?: string;
  isSidebarOpen?: boolean;
  quickActionElement?: React.ReactNode;
  preventDefaultProgress?: boolean;
  leftElementClassName?: string;
  rightElementClassName?: string;
}

export function ListItem(props: IListItemProps) {
  const {
    id,
    compact = false,
    fullRowLink = false,
    title,
    leadingElement,
    prependTitleElement,
    prependTitleTooltip,
    appendTitleElement,
    appendTitleTooltip,
    actionableItems,
    itemLink,
    onItemClick,
    isMobile = false,
    parentRef,
    disableLink = false,
    className = "",
    actionItemContainerClassName = "",
    isSidebarOpen = false,
    quickActionElement,
    itemClassName = "",
    titleClassName = "",
    preventDefaultProgress = false,
    leftElementClassName = "",
    rightElementClassName = "",
  } = props;

  const stretchLink = compact || fullRowLink;

  const appendedTitle = appendTitleElement && (
    <Tooltip label={appendTitleTooltip ?? ""} disabled={!appendTitleTooltip || isMobile}>
      <span className={cn("flex flex-shrink-0 items-center", stretchLink && "relative z-20", rightElementClassName)}>
        {appendTitleElement}
      </span>
    </Tooltip>
  );

  // router
  const router = useAppRouter();

  // handlers
  const handleControlLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onItemClick) onItemClick(e);
    else router.push(itemLink);
  };

  return (
    <div ref={parentRef} className="relative">
      <Row
        className={cn(
          "group flex min-h-[52px] w-full flex-col items-center justify-between gap-3 border-b border-subtle bg-layer-transparent py-4 text-13 hover:bg-layer-transparent-hover",
          { "xl:flex-row xl:gap-5 xl:py-0": isSidebarOpen, "lg:flex-row lg:gap-5 lg:py-0": !isSidebarOpen },
          fullRowLink && "relative isolate",
          compact && "group/list-item relative isolate min-h-[38px]! flex-row! gap-0! rounded-[6px] p-0!",
          className
        )}
      >
        <div
          className={cn(
            "relative flex w-full items-center justify-between gap-3 truncate",
            stretchLink && "static",
            compact && "gap-2 p-2",
            itemClassName
          )}
        >
          {stretchLink && leadingElement ? (
            <div className="relative z-20 shrink-0">{leadingElement}</div>
          ) : (
            leadingElement
          )}
          <ControlLink
            id={id}
            className={cn(
              "relative flex w-full items-center gap-3 overflow-hidden",
              stretchLink && "static overflow-visible after:absolute after:inset-0 after:z-10 after:content-['']",
              compact && "gap-2 after:rounded-[6px]"
            )}
            href={itemLink}
            target="_self"
            onClick={handleControlLinkClick}
            disabled={disableLink}
            data-prevent-progress={preventDefaultProgress}
          >
            <div
              className={cn("flex items-center gap-4 truncate", compact && "relative z-20 gap-2", leftElementClassName)}
            >
              {prependTitleElement && (
                <Tooltip label={prependTitleTooltip ?? ""} disabled={!prependTitleTooltip || isMobile}>
                  <span className="flex flex-shrink-0 items-center">{prependTitleElement}</span>
                </Tooltip>
              )}
              <Tooltip label={title} layout="stacked" disabled={isMobile}>
                <span className={cn("truncate text-13", compact && "text-body-sm-medium", titleClassName)}>
                  {title}
                </span>
              </Tooltip>
            </div>
            {!fullRowLink && appendedTitle}
          </ControlLink>
          {fullRowLink && appendedTitle}
          {stretchLink ? <div className="relative z-20 shrink-0">{quickActionElement}</div> : quickActionElement}
        </div>
        {actionableItems && (
          <div
            className={cn(
              "relative flex w-full flex-shrink-0 flex-wrap items-center justify-start gap-4",
              {
                "xl:w-auto xl:flex-shrink-0 xl:flex-nowrap": isSidebarOpen,
                "lg:w-auto lg:flex-shrink-0 lg:flex-nowrap": !isSidebarOpen,
              },
              fullRowLink && "z-20",
              actionItemContainerClassName
            )}
          >
            {actionableItems}
          </div>
        )}
      </Row>
    </div>
  );
}
