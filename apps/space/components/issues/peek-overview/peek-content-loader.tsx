import { Loader } from "@plane/blocks/skeleton";

/** Title and description placeholder shared by the side and full-screen peek views. */
export function PeekContentLoader() {
  return (
    <Loader className="px-6">
      <Loader.Item height="30px" />
      <div className="mt-3 space-y-2">
        <Loader.Item height="20px" width="70%" />
        <Loader.Item height="20px" width="60%" />
        <Loader.Item height="20px" width="60%" />
      </div>
    </Loader>
  );
}
