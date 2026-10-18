import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CustomImageNodeViewProps } from "./node-view";

type RecoverySession = { active: boolean; pending: boolean; attempted: boolean };
type ImageRecoveryOptions = {
  imageRef: RefObject<HTMLImageElement | null>;
  nodeSrc: string | null | undefined;
  resolvedSrc: string | undefined;
  displayedSrc: string | undefined;
  isTouchDevice: boolean;
  options: CustomImageNodeViewProps["extension"]["options"];
  setFailedToLoadImage: (failed: boolean) => void;
};

/** Owns the single recovery attempt for the currently displayed image. */
export function useImageRecovery({
  imageRef,
  nodeSrc,
  resolvedSrc,
  displayedSrc,
  isTouchDevice,
  options,
  setFailedToLoadImage,
}: ImageRecoveryOptions) {
  const source = useMemo(() => ({ nodeSrc, resolvedSrc, displayedSrc }), [nodeSrc, resolvedSrc, displayedSrc]);
  const sessionRef = useRef<RecoverySession | null>(null);
  const [recoveringSource, setRecoveringSource] = useState<typeof source | null>(null);

  useLayoutEffect(() => {
    const session = { active: true, pending: false, attempted: false, source };
    sessionRef.current = session;
    return () => {
      session.active = false;
    };
  }, [source]);

  const handleImageError = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.active || session.pending) return;
    if (!options.restoreImage || session.attempted) {
      setFailedToLoadImage(true);
      return;
    }
    const image = imageRef.current;
    const isCurrent = () => session.active && image !== null && imageRef.current === image;
    session.pending = true;
    session.attempted = true;
    setRecoveringSource(source);
    try {
      if (!nodeSrc) throw new Error("No source image to restore from");
      await options.restoreImage(nodeSrc);
      if (!isCurrent()) return;
      if (!resolvedSrc) throw new Error("No resolved image source available");
      const retrySrc = isTouchDevice ? await options.getImageSource?.(nodeSrc) : resolvedSrc;
      if (!isCurrent() || !image) return;
      image.src = retrySrc;
    } catch (error) {
      if (!isCurrent()) return;
      setFailedToLoadImage(true);
      console.error("Error while loading image", error);
    } finally {
      if (session.active) {
        session.pending = false;
        setRecoveringSource(null);
      }
    }
  }, [source, imageRef, nodeSrc, resolvedSrc, isTouchDevice, options, setFailedToLoadImage]);

  return { isRecovering: recoveringSource === source, handleImageError };
}
