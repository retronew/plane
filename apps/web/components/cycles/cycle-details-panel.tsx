import type { ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { cn } from "@plane/utils";

/** Shares the sidebar's presence and motion between cycle lists and detail pages. */
export function CycleDetailsPanel({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible.Root open={open} render={({ children: content }) => <>{content}</>}>
      <Collapsible.Panel
        data-cycle-peek=""
        className={cn(
          "group/cycle-peek fixed right-0 z-13 h-full w-full max-w-[21.5rem] flex-shrink-0 overflow-hidden transition-[width,translate] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none max-md:data-[ending-style]:translate-x-full max-md:data-[starting-style]:translate-x-full md:relative md:w-[21.5rem] md:data-[ending-style]:w-0 md:data-[starting-style]:w-0",
          className
        )}
      >
        <div
          data-cycle-details-content=""
          className="vertical-scrollbar scrollbar-sm flex h-full w-[min(100vw,21.5rem)] flex-col gap-3.5 overflow-y-auto border-l border-subtle bg-surface-1 px-4 opacity-100 shadow-raised-200 transition-[translate,opacity] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[ending-style]/cycle-peek:translate-x-4 group-data-[ending-style]/cycle-peek:opacity-0 group-data-[starting-style]/cycle-peek:translate-x-4 group-data-[starting-style]/cycle-peek:opacity-0 motion-reduce:transition-none"
        >
          {children}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
