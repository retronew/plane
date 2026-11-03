import { Loader } from "@plane/blocks/skeleton";
import { cn } from "@plane/utils";

export function DescriptionInputLoader({ className }: { className?: string }) {
  return (
    <div data-description-loading="" aria-busy="true" className={cn("relative pb-3 pl-3", className)}>
      <Loader className="min-h-32 space-y-3 py-3">
        <Loader.Item width="92%" height="16px" />
        <Loader.Item width="80%" height="16px" />
        <Loader.Item width="60%" height="16px" />
      </Loader>
    </div>
  );
}
