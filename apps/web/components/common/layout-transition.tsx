import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const getServerMotion = () => false;
function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const LayoutReadyContext = createContext<((ready: boolean) => void) | undefined>(undefined);

/** Loading layouts report when the real content (or empty state) can enter. */
export function useLayoutTransitionReady(ready: boolean) {
  const reportReady = useContext(LayoutReadyContext);
  useEffect(() => {
    reportReady?.(ready);
  }, [ready, reportReady]);
}

/** Suspense commits this boundary only after its content is available. */
export function LayoutTransitionContent({ children }: { children: ReactNode }) {
  useLayoutTransitionReady(true);
  return children;
}

/** Finish the outgoing view before mounting the latest requested layout. */
export function LayoutTransition<T extends string>({
  layout,
  children,
  waitForReady = false,
  onLayoutCommit,
}: {
  layout: T;
  waitForReady?: boolean;
  onLayoutCommit?: (layout: T) => void;
  children: (layout: T) => ReactNode;
}) {
  const [visibleLayout, setVisibleLayout] = useState(layout);
  const [isEntering, setEntering] = useState(true);
  useLayoutEffect(() => {
    onLayoutCommit?.(visibleLayout);
  }, [visibleLayout, onLayoutCommit]);
  const [readyLayout, setReadyLayout] = useState<T>();
  const enteredLayout = useRef<T | undefined>(undefined);
  const reportReady = useCallback(
    (ready: boolean) => {
      if (ready) {
        setReadyLayout(visibleLayout);
      } else if (enteredLayout.current !== visibleLayout) {
        setReadyLayout((current) => (current === visibleLayout ? undefined : current));
        setEntering(true);
      }
    },
    [visibleLayout]
  );
  const readyContext = useMemo(() => (waitForReady ? reportReady : undefined), [waitForReady, reportReady]);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, getServerMotion);
  // A reduced-motion switch has no animation event to commit the new layout.
  if (reducedMotion && layout !== visibleLayout) setVisibleLayout(layout);
  const phase = reducedMotion
    ? "idle"
    : layout !== visibleLayout
      ? "exit"
      : waitForReady && readyLayout !== visibleLayout
        ? "loading"
        : isEntering
          ? "enter"
          : "idle";
  return (
    <div
      className="project-layout-transition h-full min-h-0 w-full"
      data-project-transition={phase}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        if (phase === "exit" && event.animationName === "project-layout-out") {
          setReadyLayout(undefined);
          setVisibleLayout(layout);
          setEntering(true);
        } else if (phase === "enter" && event.animationName === "project-layout-in") {
          enteredLayout.current = visibleLayout;
          setEntering(false);
        }
      }}
    >
      <LayoutReadyContext.Provider key={visibleLayout} value={readyContext}>
        {children(visibleLayout)}
      </LayoutReadyContext.Provider>
    </div>
  );
}
