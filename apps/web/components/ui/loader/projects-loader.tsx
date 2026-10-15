import { Skeleton, SkeletonItem } from "@makeplane/propel/components/skeleton";
import { useTranslation } from "@plane/i18n";
import type { TProjectLayout } from "@plane/types";
import { cn } from "@plane/utils";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";

function CardPlaceholder() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-subtle bg-layer-1 p-1">
      <div className="relative h-[108px] rounded-lg bg-[#262626]">
        <div className="absolute top-3 left-3 size-9 rounded-md bg-white/10" />
      </div>
      <div className="flex flex-col gap-2 p-2">
        <SkeletonItem blockSize="14px" inlineSize="60%" />
        <SkeletonItem blockSize="12px" inlineSize="30%" />
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <SkeletonItem key={i} blockSize="24px" inlineSize="25%" />
          ))}
        </div>
      </div>
    </div>
  );
}
export function ProjectsLoader({ layout = "gallery" }: { layout?: TProjectLayout }) {
  const { t } = useTranslation();
  const showSkeleton = useDelayedLoading(true);
  if (!showSkeleton) return <div className="size-full" aria-busy="true" />;
  return (
    <div
      data-project-loader={layout}
      className={cn("h-full min-h-0 w-full overflow-hidden", layout === "gallery" || layout === "board" ? "p-4" : "")}
    >
      <Skeleton aria-label={t("loading")}>
        {layout === "gallery" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <CardPlaceholder key={i} />
            ))}
          </div>
        )}
        {layout === "board" && (
          <div className="flex gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex w-[336px] shrink-0 flex-col gap-3 rounded-xl bg-layer-1 p-2">
                <SkeletonItem blockSize="24px" inlineSize="40%" />
                <CardPlaceholder />
                <CardPlaceholder />
              </div>
            ))}
          </div>
        )}
        {layout === "list" && (
          <div>
            <div className="border-b border-subtle bg-layer-1 px-6 py-2">
              <SkeletonItem blockSize="20px" inlineSize="90px" />
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-12 items-center gap-3 border-b border-subtle px-3">
                <SkeletonItem blockSize="36px" inlineSize="36px" />
                <SkeletonItem blockSize="14px" inlineSize="25%" />
                <div className="ml-auto flex gap-2">
                  <SkeletonItem blockSize="24px" inlineSize="70px" />
                  <SkeletonItem blockSize="24px" inlineSize="90px" />
                </div>
              </div>
            ))}
          </div>
        )}
        {layout === "timeline" && (
          <div>
            <div className="flex h-11 items-center gap-6 border-b border-subtle px-6">
              <SkeletonItem blockSize="16px" inlineSize="25%" />
              {[0, 1, 2].map((i) => (
                <SkeletonItem key={i} blockSize="14px" inlineSize="15%" />
              ))}
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-11 items-center border-b border-subtle px-6">
                <SkeletonItem blockSize="14px" inlineSize="25%" />
                <div className="w-1/2 pl-12">
                  <SkeletonItem blockSize="24px" inlineSize={`${40 + i * 8}%`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Skeleton>
    </div>
  );
}
