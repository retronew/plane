import { Loader } from "@plane/blocks/skeleton";
import { DescriptionInputLoader } from "@/components/editor/rich-text/description-input/loader";

export function IssueDetailContentSkeleton({
  peek = false,
  hasParent = false,
  propertyCount = 10,
}: {
  peek?: boolean;
  hasParent?: boolean;
  propertyCount?: number;
}) {
  return (
    <>
      <div className={peek ? "space-y-2" : "space-y-4 rounded-lg"}>
        {hasParent && (
          <Loader className="flex h-8 items-center">
            <Loader.Item height="20px" width="220px" />
          </Loader>
        )}
        <div data-detail-slot="header" className={peek ? "h-6" : "mb-2.5 h-6"}>
          <Loader>
            <Loader.Item height="24px" width="110px" />
          </Loader>
        </div>
        <div data-detail-slot="title" className="h-8">
          <Loader>
            <Loader.Item height="32px" width="65%" />
          </Loader>
        </div>
        <div data-detail-slot="description">
          <DescriptionInputLoader className={peek ? "-ml-3 border-none" : "-ml-6 border-none p-0! pl-6!"} />
        </div>
        <Loader className="flex h-11 items-center justify-between">
          <Loader.Item height="24px" width="80px" />
          <Loader.Item height="20px" width="140px" />
        </Loader>
      </div>
      <Loader className={peek ? "flex h-[60px] items-center gap-3 py-2" : "flex h-11 items-center gap-3"}>
        <Loader.Item height="28px" width="120px" />
        <Loader.Item height="28px" width="100px" />
      </Loader>
      {peek && (
        <div data-detail-slot="properties" style={{ height: 32 + propertyCount * 42 }}>
          <Loader>
            <Loader.Item height="20px" width="60px" />
          </Loader>
          <Loader className="mt-3 space-y-3">
            {Array.from({ length: propertyCount }, (_, index) => (
              <div key={index} className="flex h-[30px] items-center gap-2">
                <Loader.Item height="16px" width="120px" />
                <Loader.Item height="24px" width="40%" />
              </div>
            ))}
          </Loader>
        </div>
      )}
      <div data-detail-slot="activity">
        <Loader className="space-y-4">
          <div className="flex h-7 items-center justify-between">
            <Loader.Item height="24px" width="60%" />
            <Loader.Item height="24px" width="24px" />
          </div>
          <Loader.Item height="44px" width="85%" />
          <Loader.Item height="44px" width="70%" />
        </Loader>
      </div>
    </>
  );
}

/** Match detail padding, title line box, editor and property column dimensions. */
export function IssueDetailSkeleton({ hasParent = false }: { hasParent?: boolean }) {
  return (
    <div data-issue-detail-loading="" aria-busy="true" className="flex h-full w-full overflow-hidden">
      <div className="min-w-0 flex-1 space-y-6 overflow-hidden px-9 py-5">
        <IssueDetailContentSkeleton hasParent={hasParent} />
      </div>
      <div className="hidden min-w-80 border-l border-subtle px-6 md:block md:w-1/4 xl:min-w-96">
        <Loader className="mt-5">
          <Loader.Item height="16px" width="80px" />
        </Loader>
        <Loader className="mt-4 space-y-2.5">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="flex h-[30px] items-center gap-4">
              <Loader.Item height="16px" width="35%" />
              <Loader.Item height="24px" width="50%" />
            </div>
          ))}
        </Loader>
      </div>
    </div>
  );
}
