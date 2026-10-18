import { Loader } from "@plane/blocks/skeleton";

/** Description placeholder shared by the issue peek loader and the description-versions dialog. */
export function DescriptionSkeleton() {
  return (
    <div className="space-y-1">
      <Loader.Item width="300px" height="15px" />
      <Loader.Item width="400px" height="15px" />
      <div className="flex items-center gap-2">
        <Loader.Item width="20px" height="15px" />
        <Loader.Item width="500px" height="15px" />
      </div>
      <div className="flex items-center gap-2">
        <Loader.Item width="20px" height="15px" />
        <Loader.Item width="200px" height="15px" />
      </div>
      <Loader.Item width="300px" height="15px" />
      <Loader.Item width="200px" height="15px" />
    </div>
  );
}
