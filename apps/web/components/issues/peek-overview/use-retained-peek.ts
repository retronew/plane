import { useCallback, useEffect, useState } from "react";

export const PEEK_EXIT_DURATION = 500;

/** Keep the last item mounted while its exit animation finishes. */
export function useRetainedPeek<T>(value: T | undefined, enabled = true) {
  const [retained, setRetained] = useState(value);
  if (value !== undefined && retained !== value) setRetained(value);
  useEffect(() => {
    if (value !== undefined || retained === undefined || !enabled) return;
    const timer = setTimeout(() => setRetained(undefined), PEEK_EXIT_DURATION);
    return () => clearTimeout(timer);
  }, [value, retained, enabled]);
  const onExited = useCallback(() => {
    if (value === undefined) setRetained(undefined);
  }, [value]);
  return {
    item: value ?? (enabled ? retained : undefined),
    closing: enabled && value === undefined && retained !== undefined,
    onExited,
  };
}
