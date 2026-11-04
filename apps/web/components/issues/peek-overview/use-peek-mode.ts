import { useLocalStorage } from "@plane/hooks";
import type { TPeekModes } from "./header";

export function usePeekMode() {
  const { storedValue, setValue } = useLocalStorage<TPeekModes>("issue_peek_mode", "side-peek");
  const mode: TPeekModes = storedValue === "modal" ? "modal" : "side-peek";
  return { mode, setMode: setValue };
}
