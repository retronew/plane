/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { SPREADSHEET_SELECT_GROUP } from "@plane/constants";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TIssue } from "@plane/types";
// components
import { useWindowedRows } from "@plane/blocks/virtual-list";
import { IssueRowExpansionProvider } from "../row-expansion";
import { SpreadsheetIssueRowLoader } from "@/components/ui/loader/layouts/spreadsheet-layout-loader";
// hooks
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import { getDisplayPropertiesCount } from "../utils";
import { SpreadsheetIssueRow } from "./issue-row";
import { SpreadsheetHeader } from "./spreadsheet-header";

type Props = {
  displayProperties: IIssueDisplayProperties;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayPropertiesUpdate: (data: Partial<IIssueDisplayProperties>) => void;
  handleDisplayFilterUpdate: (data: Partial<IIssueDisplayFilterOptions>) => void;
  issueIds: string[];
  isEstimateEnabled: boolean;
  quickActions: TRenderQuickActions;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  canEditProperties: (projectId: string | undefined) => boolean;
  portalElement: React.MutableRefObject<HTMLDivElement | null>;
  containerRef: MutableRefObject<HTMLTableElement | null>;
  canLoadMoreIssues: boolean;
  loadMoreIssues: () => void;
  spreadsheetColumnsList: (keyof IIssueDisplayProperties)[];
  selectionHelpers: TSelectionHelper;
  isEpic?: boolean;
};

export const SpreadsheetTable = observer(function SpreadsheetTable(props: Props) {
  const {
    displayProperties,
    displayFilters,
    handleDisplayFilterUpdate,
    handleDisplayPropertiesUpdate,
    issueIds,
    isEstimateEnabled,
    portalElement,
    quickActions,
    updateIssue,
    canEditProperties,
    canLoadMoreIssues,
    containerRef,
    loadMoreIssues,
    spreadsheetColumnsList,
    selectionHelpers,
    isEpic = false,
  } = props;

  const tableRef = useRef<HTMLTableElement | null>(null);
  const virtualized = issueIds.length > 100;
  const getItemKey = useCallback((index: number) => issueIds[index], [issueIds]);
  const { virtualizer, scrollMargin } = useWindowedRows({
    count: issueIds.length,
    estimateSize: 45,
    getItemKey,
    scrollRef: containerRef,
    contentRef: tableRef,
    enabled: virtualized,
    headerHeight: 44,
  });
  const { getActiveEntityDetails } = useMultipleSelectStore();
  const active = getActiveEntityDetails();
  const activeIndex = active?.groupID === SPREADSHEET_SELECT_GROUP ? issueIds.indexOf(active.entityID) : -1;
  useLayoutEffect(() => {
    if (virtualized && activeIndex >= 0) virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [virtualized, activeIndex, virtualizer]);
  const [pendingFocus, setPendingFocus] = useState<{ index: number; column: number } | null>(null);
  const virtualRows = virtualizer.getVirtualItems();
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    const cell = tableRef.current?.querySelector<HTMLElement>(`tbody[data-virtual-index="${pendingFocus.index}"] tr`)
      ?.children[pendingFocus.column] as HTMLElement | undefined;
    if (!cell) return;
    cell.focus({ preventScroll: true });
    setPendingFocus(null);
  }, [pendingFocus, virtualRows]);
  // states
  const isScrolled = useRef(false);
  const [intersectionElement, setIntersectionElement] = useState<HTMLTableSectionElement | null>(null);

  const {
    issues: { getIssueLoader },
  } = useIssuesStore();

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;

    const columnShadow = "8px 22px 22px 10px rgba(0, 0, 0, 0.05)"; // shadow for regular columns
    const headerShadow = "8px -22px 22px 10px rgba(0, 0, 0, 0.05)"; // shadow for headers

    //The shadow styles are added this way to avoid re-render of all the rows of table, which could be costly
    if (scrollLeft > 0 !== isScrolled.current) {
      const firstColumns = containerRef.current.querySelectorAll(
        "table tr:not([data-virtual-spacer]) td:first-child, th:first-child"
      );

      for (let i = 0; i < firstColumns.length; i++) {
        const shadow = i === 0 ? headerShadow : columnShadow;
        if (scrollLeft > 0) {
          (firstColumns[i] as HTMLElement).style.boxShadow = shadow;
        } else {
          (firstColumns[i] as HTMLElement).style.boxShadow = "none";
        }
      }
      isScrolled.current = scrollLeft > 0;
    }
  }, [containerRef]);

  useEffect(() => {
    const currentContainerRef = containerRef.current;

    if (currentContainerRef) currentContainerRef.addEventListener("scroll", handleScroll);

    return () => {
      if (currentContainerRef) currentContainerRef.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll, containerRef]);

  const isPaginating = !!getIssueLoader();

  useIntersectionObserver(containerRef, isPaginating ? null : intersectionElement, loadMoreIssues, `100% 0% 100% 0%`);

  const handleKeyBoardNavigation = useTableKeyboardNavigation(
    virtualized
      ? (index, column) => {
          if (index >= issueIds.length) return;
          virtualizer.scrollToIndex(index, { align: "auto" });
          setPendingFocus({ index, column });
        }
      : undefined
  );

  const ignoreFieldsForCounting: (keyof IIssueDisplayProperties)[] = ["key"];
  if (!isEstimateEnabled) ignoreFieldsForCounting.push("estimate");
  const displayPropertiesCount = getDisplayPropertiesCount(displayProperties, ignoreFieldsForCounting);

  const renderRow = (id: string) => (
    <SpreadsheetIssueRow
      key={id}
      issueId={id}
      displayProperties={displayProperties}
      quickActions={quickActions}
      canEditProperties={canEditProperties}
      nestingLevel={0}
      isEstimateEnabled={isEstimateEnabled}
      updateIssue={updateIssue}
      portalElement={portalElement}
      containerRef={containerRef}
      isScrolled={isScrolled}
      spreadsheetColumnsList={spreadsheetColumnsList}
      selectionHelpers={selectionHelpers}
      isEpic={isEpic}
      virtualized={virtualized}
    />
  );
  const spacer = (height: number) =>
    height > 0 ? (
      <tbody aria-hidden="true">
        <tr data-virtual-spacer>
          <td
            aria-label="Virtual spacer"
            colSpan={displayPropertiesCount + 2}
            style={{ height, padding: 0, border: 0 }}
          />
        </tr>
      </tbody>
    ) : null;

  return (
    <IssueRowExpansionProvider>
      <table
        // The native table is an interactive grid: focusable cells support arrow-key navigation.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
        role="grid"
        ref={tableRef}
        data-virtual-table={virtualized || undefined}
        className="w-full border-separate border-spacing-0 overflow-y-auto bg-surface-1"
        onKeyDown={handleKeyBoardNavigation}
      >
        <SpreadsheetHeader
          displayProperties={displayProperties}
          displayFilters={displayFilters}
          handleDisplayFilterUpdate={handleDisplayFilterUpdate}
          handleDisplayPropertiesUpdate={handleDisplayPropertiesUpdate}
          canEditProperties={canEditProperties}
          isEstimateEnabled={isEstimateEnabled}
          spreadsheetColumnsList={spreadsheetColumnsList}
          selectionHelpers={selectionHelpers}
          isEpic={isEpic}
        />
        {virtualized ? (
          <>
            {virtualRows.map((row, index) => (
              <Fragment key={row.key}>
                {spacer(row.start - (virtualRows[index - 1]?.end ?? scrollMargin))}
                <tbody data-index={row.index} data-virtual-index={row.index} ref={virtualizer.measureElement}>
                  {renderRow(issueIds[row.index])}
                </tbody>
              </Fragment>
            ))}
            {spacer(virtualizer.getTotalSize() - ((virtualRows.at(-1)?.end ?? scrollMargin) - scrollMargin))}
          </>
        ) : (
          <tbody>{issueIds.map(renderRow)}</tbody>
        )}
        {canLoadMoreIssues && (
          <tfoot ref={setIntersectionElement}>
            {["first", "second", "third"].map((key) => (
              <SpreadsheetIssueRowLoader key={key} columnCount={displayPropertiesCount + 1} />
            ))}
          </tfoot>
        )}
      </table>
    </IssueRowExpansionProvider>
  );
});
