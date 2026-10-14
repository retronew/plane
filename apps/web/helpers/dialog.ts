import type { Dialog } from "@base-ui/react/dialog";

/** Propel forwards popup props to Base UI, but omits initialFocus from its published type. */
export function getDialogInitialFocusProps(selector: string): Pick<Dialog.Popup.Props, "initialFocus"> {
  return {
    initialFocus: (interactionType) =>
      interactionType === "touch" ? true : document.querySelector<HTMLElement>(selector),
  };
}
