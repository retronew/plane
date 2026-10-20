/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useEffectEvent, useState } from "react";
import { observer } from "mobx-react";
import { usePathname, useSearchParams } from "next/navigation";
// hooks
import { generateQueryParams } from "@plane/utils";
import { useModule } from "@/hooks/store/use-module";
import { useAppRouter } from "@/hooks/use-app-router";
// components
import { ModuleAnalyticsSidebar } from "./";

type Props = {
  projectId: string;
  workspaceSlug: string;
  isArchived?: boolean;
};

export const ModulePeekOverview = observer(function ModulePeekOverview({
  projectId,
  workspaceSlug,
  isArchived = false,
}: Props) {
  // router
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const peekModule = searchParams.get("peekModule");
  // refs
  const ref = React.useRef<HTMLDivElement>(null);
  const [visibleModule, setVisibleModule] = useState(peekModule);
  const [entered, setEntered] = useState(false);
  // store hooks
  const { fetchModuleDetails, fetchArchivedModuleDetails } = useModule();

  const handleClose = useCallback(() => {
    const query = generateQueryParams(searchParams, ["peekModule"]);
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!peekModule) return;
    if (isArchived) fetchArchivedModuleDetails(workspaceSlug, projectId, peekModule.toString());
    else fetchModuleDetails(workspaceSlug, projectId, peekModule.toString());
  }, [fetchArchivedModuleDetails, fetchModuleDetails, isArchived, peekModule, projectId, workspaceSlug]);

  useEffect(() => {
    if (peekModule) {
      setVisibleModule(peekModule);
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = setTimeout(() => setVisibleModule(null), 200);
    return () => clearTimeout(timer);
  }, [peekModule]);

  const closeOnEscape = useEffectEvent(handleClose);

  useEffect(() => {
    if (!peekModule) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) closeOnEscape();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [peekModule]);

  return (
    <>
      {visibleModule && (
        <div
          ref={ref}
          className="absolute inset-y-0 right-0 z-[9] flex h-full w-full max-w-[24rem] flex-col gap-3.5 overflow-y-auto border-l border-subtle bg-surface-1 px-6 transition-[transform,opacity] duration-200 motion-reduce:transition-none"
          inert={!peekModule}
          aria-hidden={!peekModule}
          style={{
            transform: entered ? "translateX(0)" : "translateX(100%)",
            opacity: entered ? 1 : 0,
            boxShadow:
              "0px 1px 4px 0px rgba(0, 0, 0, 0.06), 0px 2px 4px 0px rgba(16, 24, 40, 0.06), 0px 1px 8px -1px rgba(16, 24, 40, 0.06)",
          }}
        >
          <ModuleAnalyticsSidebar moduleId={visibleModule} handleClose={handleClose} isArchived={isArchived} />
        </div>
      )}
    </>
  );
});
