import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

type ExpansionState = {
  expanded: Set<string>;
  update: (id: string, value: SetStateAction<boolean>) => void;
};
const RowExpansion = createContext<ExpansionState | null>(null);

/** Expanded descendants survive virtual rows leaving the viewport. */
export function IssueRowExpansionProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const update = useCallback((id: string, value: SetStateAction<boolean>) => {
    setExpanded((current) => {
      const nextValue = typeof value === "function" ? value(current.has(id)) : value;
      if (current.has(id) === nextValue) return current;
      const next = new Set(current);
      if (nextValue) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ expanded, update }), [expanded, update]);
  return <RowExpansion.Provider value={value}>{children}</RowExpansion.Provider>;
}

export function useIssueRowExpansion(id: string): [boolean, Dispatch<SetStateAction<boolean>>] {
  const state = useContext(RowExpansion);
  const [local, setLocal] = useState(false);
  const update = state?.update;
  const setExpanded = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) => {
      if (update) update(id, value);
      else setLocal(value);
    },
    [id, update]
  );
  return [state ? state.expanded.has(id) : local, setExpanded];
}
