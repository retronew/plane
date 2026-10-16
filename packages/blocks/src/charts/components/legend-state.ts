import { useState } from "react";

/** Shared series visibility and emphasis; discard stale choices when the series set changes. */
export function useChartLegend(keys: readonly string[]) {
  const scope = JSON.stringify(keys);
  const [state, setState] = useState<{ scope: string; hidden: Set<string>; active: string | null }>({
    scope,
    hidden: new Set(),
    active: null,
  });
  if (state.scope !== scope) setState({ scope, hidden: new Set(), active: null });
  const hidden = state.scope === scope ? state.hidden : new Set<string>();
  const activeKey = state.scope === scope ? state.active : null;
  return {
    hidden,
    activeKey,
    visibleKeys: keys.filter((key) => !hidden.has(key)),
    onHover: (key: string | null) => setState((current) => ({ ...current, active: key })),
    onToggle: (key: string) =>
      setState((current) => {
        const next = new Set(current.hidden);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return { ...current, hidden: next };
      }),
  };
}
export type ChartLegendState = ReturnType<typeof useChartLegend>;
