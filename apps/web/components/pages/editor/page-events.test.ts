import { expect, it, vi } from "vitest";
import { dispatchPageEvent } from "./page-events";

it("dispatches validated page title and content-limit events", () => {
  const dispatch = vi.fn();
  const affectedPages = { currentPage: "page", descendantPages: ["child", 42] };
  dispatchPageEvent({ action: "property_updated", affectedPages, data: { name: "Updated" } }, dispatch);
  expect(dispatch).toHaveBeenCalledWith(["page", "child"], "property_updated", { name: "Updated" });
  dispatchPageEvent(
    {
      action: "error",
      affectedPages,
      data: { error_type: "store", error_message: "Large", error_code: "content_too_large" },
    },
    dispatch
  );
  expect(dispatch).toHaveBeenLastCalledWith(["page", "child"], "error", {
    error_type: "store",
    error_message: "Large",
    error_code: "content_too_large",
  });
});

it("ignores malformed events and persistence acknowledgements", () => {
  const dispatch = vi.fn();
  for (const value of [null, "locked", { type: "saved" }, { action: "deleted", affectedPages: null }])
    dispatchPageEvent(value, dispatch);
  expect(dispatch).not.toHaveBeenCalled();
});
