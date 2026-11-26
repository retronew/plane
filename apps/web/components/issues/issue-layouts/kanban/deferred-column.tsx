/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

type Props = {
  children: ReactNode;
  className: string;
  name: string;
  root?: RefObject<HTMLDivElement | null>;
};

// Keep the full horizontal scroll range, but don't mount every project's card editors,
// drag targets and pagination sentinel before its column can actually be seen.
export function DeferredKanbanColumn({ children, className, name, root }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const [visited, setVisited] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (visited || !element.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisited(true);
      },
      { root: root?.current ?? null, rootMargin: "0px 352px" }
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [root, visited]);

  // Once visited, preserve vertical scroll, keyboard focus and any active drag or editor.
  return (
    <div ref={element} className={className}>
      {/* Retain the keyboard anchor when focus reveals the column, so Tab enters its cards. */}
      <button
        type="button"
        className="sr-only"
        aria-label={name}
        tabIndex={visited ? -1 : 0}
        onFocus={() => setVisited(true)}
        onClick={() => setVisited(true)}
      />
      {visited ? children : null}
    </div>
  );
}
