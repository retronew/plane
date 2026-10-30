export function shouldSubmitComment(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey" | "isComposing">,
  shortcut: "enter" | "mod-enter",
  blocked: boolean
) {
  if (blocked || event.isComposing || event.key !== "Enter" || event.shiftKey || event.altKey) return false;
  return shortcut === "mod-enter" ? event.metaKey || event.ctrlKey : !event.metaKey && !event.ctrlKey;
}
