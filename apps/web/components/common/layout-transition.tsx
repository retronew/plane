import {
  createContext,
  memo,
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
  useLayoutEffect(() => {
    reportReady?.(ready);
  }, [ready, reportReady]);
}

/** Suspense commits this boundary only after its content is available. */
// react-doctor-disable-next-line react-doctor/only-export-components -- LayoutTransitionContent is a component; it returns `children` directly, which the JSX-return heuristic misreads as a non-component export.
export function LayoutTransitionContent({ children }: { children: ReactNode }) {
  useLayoutTransitionReady(true);
  return children;
}

const SKELETON_VISIBLE_THRESHOLD_MS = 40;
const EXIT_ANIMATION_FALLBACK_MS = 220;
const ENTER_ANIMATION_FALLBACK_MS = 320;

const LayoutSlot = memo(
  function LayoutSlot({ renderLayout }: { visibleLayout: string; frozen: boolean; renderLayout: () => ReactNode }) {
    return <>{renderLayout()}</>;
  },
  (prev, next) => next.frozen && prev.visibleLayout === next.visibleLayout
);

/** Finish the outgoing view before mounting the latest requested layout. */
export function LayoutTransition<T extends string>({
  layout,
  children,
  waitForReady = false,
  animateInitial = true,
  onLayoutCommit,
}: {
  layout: T;
  waitForReady?: boolean;
  animateInitial?: boolean;
  onLayoutCommit?: (layout: T) => void;
  children: (layout: T) => ReactNode;
}) {
  const [visibleLayout, setVisibleLayout] = useState(layout);
  const [isEntering, setEntering] = useState(animateInitial);
  const lastCommittedRef = useRef<T | undefined>(undefined);
  const loadingStartedAtRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (lastCommittedRef.current === visibleLayout) return;
    lastCommittedRef.current = visibleLayout;
    // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect -- notify the parent after the visible layout settles; this is a commit notification, not a prop mirrored into local state
    onLayoutCommit?.(visibleLayout);
  }, [visibleLayout, onLayoutCommit]);
  const [readyLayout, setReadyLayout] = useState<T | undefined>(animateInitial ? undefined : layout);
  const enteredLayout = useRef<T | undefined>(animateInitial ? undefined : layout);
  const commitOutgoingExit = useCallback(() => {
    lastCommittedRef.current = layout;
    onLayoutCommit?.(layout);
    loadingStartedAtRef.current = performance.now();
    setReadyLayout(undefined);
    setVisibleLayout(layout);
    setEntering(true);
  }, [layout, onLayoutCommit]);
  const settleIncomingEnter = useCallback(() => {
    enteredLayout.current = visibleLayout;
    setEntering(false);
  }, [visibleLayout]);
  const reportReady = useCallback(
    (ready: boolean) => {
      if (ready) {
        const loadingElapsed =
          loadingStartedAtRef.current !== null ? performance.now() - loadingStartedAtRef.current : 0;
        loadingStartedAtRef.current = null;
        setReadyLayout(visibleLayout);
        // If a skeleton was already visible during loading, keep the container at opacity: 1
        // so the skeleton cross-fades directly into content without flashing blank white.
        if (loadingElapsed >= SKELETON_VISIBLE_THRESHOLD_MS) {
          enteredLayout.current = visibleLayout;
          setEntering(false);
        }
      } else if (enteredLayout.current !== visibleLayout) {
        if (loadingStartedAtRef.current === null) {
          loadingStartedAtRef.current = performance.now();
        }
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

  // Guard against dropped/throttled CSS animationend events so exit/enter never stall.
  useEffect(() => {
    if (phase === "exit") {
      const timer = window.setTimeout(commitOutgoingExit, EXIT_ANIMATION_FALLBACK_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "enter") {
      const timer = window.setTimeout(settleIncomingEnter, ENTER_ANIMATION_FALLBACK_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase, commitOutgoingExit, settleIncomingEnter]);

  return (
    <div
      className="project-layout-transition h-full min-h-0 w-full"
      data-project-transition={phase}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        if (phase === "exit" && event.animationName === "project-layout-out") {
          commitOutgoingExit();
        } else if (phase === "enter" && event.animationName === "project-layout-in") {
          settleIncomingEnter();
        }
      }}
    >
      <LayoutReadyContext.Provider key={visibleLayout} value={readyContext}>
        <LayoutSlot
          visibleLayout={visibleLayout}
          frozen={phase === "exit"}
          renderLayout={() => children(visibleLayout)}
        />
      </LayoutReadyContext.Provider>
    </div>
  );
}
