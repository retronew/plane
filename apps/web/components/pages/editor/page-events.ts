import type { EventToPayloadMap } from "@plane/editor";

type Dispatch = <T extends keyof EventToPayloadMap>(ids: string[], action: T, data: EventToPayloadMap[T]) => void;

export function dispatchPageEvent(message: unknown, dispatch: Dispatch) {
  if (!message || typeof message !== "object" || !("action" in message) || !("affectedPages" in message)) return;
  const affected = message.affectedPages;
  if (
    !affected ||
    typeof affected !== "object" ||
    !("currentPage" in affected) ||
    typeof affected.currentPage !== "string"
  )
    return;
  const descendants =
    "descendantPages" in affected && Array.isArray(affected.descendantPages)
      ? affected.descendantPages.filter((id): id is string => typeof id === "string")
      : [];
  const ids = [affected.currentPage, ...descendants];
  const data = "data" in message && message.data && typeof message.data === "object" ? message.data : {};
  const user = "user_id" in message && typeof message.user_id === "string" ? message.user_id : undefined;
  switch (message.action) {
    case "locked":
    case "unlocked":
    case "unarchived":
    case "made-public":
    case "made-private":
      dispatch(ids, message.action, { user_id: user });
      break;
    case "archived":
      if ("archived_at" in data && typeof data.archived_at === "string")
        dispatch(ids, "archived", { archived_at: data.archived_at, user_id: user });
      break;
    case "deleted":
      dispatch(ids, "deleted", { user_id: user, deleted_at: null });
      break;
    case "property_updated":
      if ("name" in data && typeof data.name === "string") dispatch(ids, "property_updated", { name: data.name });
      break;
    case "error":
      if (
        "error_type" in data &&
        (data.error_type === "fetch" || data.error_type === "store") &&
        "error_message" in data &&
        typeof data.error_message === "string"
      ) {
        const errorCode = "error_code" in data && typeof data.error_code === "string" ? data.error_code : undefined;
        dispatch(ids, "error", {
          error_type: data.error_type,
          error_message: data.error_message,
          error_code:
            errorCode === "content_too_large" || errorCode === "page_locked" || errorCode === "page_archived"
              ? errorCode
              : undefined,
        });
      }
  }
}
