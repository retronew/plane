import { Loader } from "@plane/blocks/skeleton";

/** Two-column work item placeholder shared by the browse and archived-work-item routes. */
export function IssueDetailSkeleton() {
  return (
    <Loader className="flex h-full gap-5 p-5">
      <div className="basis-2/3 space-y-2">
        <Loader.Item height="30px" width="40%" />
        <Loader.Item height="15px" width="60%" />
        <Loader.Item height="15px" width="60%" />
        <Loader.Item height="15px" width="40%" />
      </div>
      <div className="basis-1/3 space-y-3">
        <Loader.Item height="30px" />
        <Loader.Item height="30px" />
        <Loader.Item height="30px" />
        <Loader.Item height="30px" />
      </div>
    </Loader>
  );
}
