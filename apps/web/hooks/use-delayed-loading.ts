import { useEffect, useState } from "react";

export const SKELETON_DELAY_MS = 180;

/** Fast requests render content directly; each slower request gets its own delay. */
export function useDelayedLoading(loading: boolean, delay = SKELETON_DELAY_MS) {
  const [state, setState] = useState({ loading, delay, visible: false });
  if (state.loading !== loading || state.delay !== delay) setState({ loading, delay, visible: false });
  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => setState({ loading, delay, visible: true }), delay);
    return () => window.clearTimeout(timeout);
  }, [loading, delay]);
  return loading && state.loading === loading && state.delay === delay && state.visible;
}
