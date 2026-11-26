/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getIssueBlockId } from "../utils";
import { isInKanbanViewport, type createCardObserver } from "./card-viewport";

interface Props {
  issueId: string;
  groupId: string;
  subGroupId: string;
  name: string;
  enabled: boolean;
  revealBeforePaint: boolean;
  pinned: boolean;
  pin: (issueId: string) => void;
  observe: ReturnType<typeof createCardObserver>;
  children: ReactNode;
}

export function DeferredKanbanCard({
  issueId,
  groupId,
  subGroupId,
  name,
  enabled,
  revealBeforePaint,
  pinned,
  pin,
  observe,
  children,
}: Props) {
  const row = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(144);
  const enterCard = useRef(false);
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const defer = enabled && typeof IntersectionObserver !== "undefined";
  const mounted = !defer || visible || focused || pinned;
  const blockId = getIssueBlockId(issueId, groupId, subGroupId);

  useLayoutEffect(() => {
    if (defer && revealBeforePaint && row.current && isInKanbanViewport(row.current)) setVisible(true);
  }, [defer, revealBeforePaint]);

  useEffect(() => {
    if (!defer || !row.current) return;
    return observe(row.current, (entry) => {
      startTransition(() => {
        if (entry.boundingClientRect.height > 0) setHeight(entry.boundingClientRect.height);
        setVisible(entry.isIntersecting && entry.intersectionRatio > 0);
      });
    });
  }, [defer, observe]);

  useLayoutEffect(() => {
    if (!mounted || !row.current) return;
    if (enterCard.current) {
      enterCard.current = false;
      document.getElementById(blockId)?.focus({ preventScroll: true });
    }
    if (!defer || typeof ResizeObserver === "undefined") return;
    // Include the card's bottom margin and remember changes from wrapping text or an edit.
    const resize = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) setHeight(entry.contentRect.height);
    });
    resize.observe(row.current);
    return () => resize.disconnect();
  }, [blockId, defer, mounted]);

  return (
    <div
      ref={row}
      className="flow-root"
      onPointerDownCapture={() => pin(issueId)}
      onFocusCapture={() => {
        setFocused(true);
        pin(issueId);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {mounted ? (
        children
      ) : (
        <div
          id={`issue-${issueId}`}
          data-issue-peek-trigger
          style={{ height }}
          className="pb-2"
          onPointerEnter={() => setVisible(true)}
        >
          <div
            aria-hidden="true"
            className="h-full overflow-hidden rounded-xl bg-layer-2 px-2.5 pt-10 text-body-sm-medium break-words text-primary shadow-raised-100"
          >
            {name}
          </div>
          <button
            type="button"
            id={blockId}
            className="sr-only"
            aria-label={name}
            onFocus={() => {
              enterCard.current = true;
            }}
          />
        </div>
      )}
    </div>
  );
}
