import { Loader } from "@plane/blocks/skeleton";

/** Description placeholder shared by the issue peek loader and the description-versions dialog. */
export function DescriptionSkeleton() {
  return (
    <Loader className="w-full space-y-2">
      <Loader.Item width="75%" height="14px" />
      <Loader.Item width="92%" height="14px" />
      <div className="flex items-center gap-2">
        <Loader.Item width="16px" height="14px" className="shrink-0" />
        <Loader.Item width="85%" height="14px" />
      </div>
      <div className="flex items-center gap-2">
        <Loader.Item width="16px" height="14px" className="shrink-0" />
        <Loader.Item width="55%" height="14px" />
      </div>
      <Loader.Item width="68%" height="14px" />
      <Loader.Item width="45%" height="14px" />
    </Loader>
  );
}
