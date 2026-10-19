/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AddOutline, CloseOutline, DownloadOutline, MinusOutline, NewTabOutline } from "@makeplane/propel/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
// plane imports
import { cn } from "@plane/utils";
import { translate } from "@plane/i18n";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_SPEED = 0.05;
const ZOOM_STEPS = [0.5, 1, 1.5, 2];

type Props = {
  aspectRatio: number;
  downloadSrc: string;
  isFullScreenEnabled: boolean;
  isTouchDevice: boolean;
  src: string;
  toggleFullScreenMode: (val: boolean) => void;
  width: string;
};

function ImageFullScreenModalWithoutPortal(props: Props) {
  const { aspectRatio, isFullScreenEnabled, isTouchDevice, downloadSrc, src, toggleFullScreenMode, width } = props;
  // refs
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  const [magnification, setMagnification] = useState<number>(1);
  const [initialMagnification, setInitialMagnification] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const widthInNumber = useMemo(() => {
    if (!width) return 0;
    return Number(width.replace("px", ""));
  }, [width]);

  const setImageRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (!node || !isFullScreenEnabled) return;
      setIsDragging(false);

      const viewportWidth = window.innerWidth * 0.9;
      const viewportHeight = window.innerHeight * 0.75;
      const imageWidth = widthInNumber;
      const imageHeight = imageWidth / aspectRatio;

      const widthRatio = viewportWidth / imageWidth;
      const heightRatio = viewportHeight / imageHeight;

      setInitialMagnification(Math.min(widthRatio, heightRatio));
      setMagnification(1);

      // Reset image position
      node.style.left = "0px";
      node.style.top = "0px";
    },
    [isFullScreenEnabled, widthInNumber, aspectRatio]
  );

  const handleClose = useCallback(
    (force = false) => {
      if (isDragging && !force) return;
      setIsDragging(false);
      toggleFullScreenMode(false);
      setMagnification(1);
      setInitialMagnification(1);
    },
    [isDragging, toggleFullScreenMode]
  );

  const handleMagnification = useCallback((direction: "increase" | "decrease") => {
    setMagnification((prev) => {
      // Find the appropriate target zoom level based on current magnification
      let targetZoom: number;
      if (direction === "increase") {
        targetZoom = ZOOM_STEPS.find((step) => step > prev) ?? MAX_ZOOM;
      } else {
        // Reverse the array to find the next lower step
        // oxlint-disable-next-line unicorn/no-array-reverse -- ZOOM_STEPS is copied first; toReversed needs ES2023 lib in consumers
        targetZoom = [...ZOOM_STEPS].reverse().find((step) => step < prev) ?? MIN_ZOOM;
      }

      return targetZoom;
    });
  }, []);

  useEffect(() => {
    if (magnification === 1 && imgRef.current) {
      imgRef.current.style.left = "0px";
      imgRef.current.style.top = "0px";
    }
  }, [magnification]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "+" || e.key === "=" || e.key === "-") {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") handleClose(true);
        if (e.key === "+" || e.key === "=") handleMagnification("increase");
        if (e.key === "-") handleMagnification("decrease");
      }
    },
    [handleClose, handleMagnification]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current) return;

    const imgWidth = imgRef.current.offsetWidth * magnification;
    const imgHeight = imgRef.current.offsetHeight * magnification;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (imgWidth > viewportWidth || imgHeight > viewportHeight) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragOffset.current = {
        x: parseInt(imgRef.current.style.left || "0"),
        y: parseInt(imgRef.current.style.top || "0"),
      };
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !imgRef.current) return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      // Apply the scale factor to the drag movement
      const scaledDx = dx / magnification;
      const scaledDy = dy / magnification;

      imgRef.current.style.left = `${dragOffset.current.x + scaledDx}px`;
      imgRef.current.style.top = `${dragOffset.current.y + scaledDy}px`;
    },
    [isDragging, magnification]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !imgRef.current) return;
    setIsDragging(false);
  }, [isDragging]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!imgRef.current || !isFullScreenEnabled) return;

      e.preventDefault();

      // Handle pinch-to-zoom
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY;
        setMagnification((prev) => {
          const newZoom = prev * (1 - delta * ZOOM_SPEED);
          const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);

          return clampedZoom;
        });
        return;
      }
    },
    [isFullScreenEnabled]
  );

  // Event listeners
  useEffect(() => {
    if (!isFullScreenEnabled) return;

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [isFullScreenEnabled, handleKeyDown, handleMouseMove, handleMouseUp, handleWheel]);

  if (!isFullScreenEnabled) return null;

  return (
    <div
      className={cn("pointer-events-none fixed inset-0 z-50 size-full bg-black/90 opacity-0 transition-opacity", {
        "editor-image-full-screen-modal pointer-events-auto opacity-100": isFullScreenEnabled,
        "cursor-default": !isDragging,
        "cursor-grabbing": isDragging,
      })}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role react-doctor/prefer-html-dialog -- Keep the viewer in the editor portal's z-index stack; a modal native dialog would enter the browser top layer and change nested overlay/focus behavior.
      role="dialog"
      aria-modal="true"
      aria-label={translate("web.fullscreen_image_viewer")}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions react-doctor/no-static-element-interactions -- mouse-only backdrop/list interaction; keyboard handled by the editor or Esc */}
      <div
        ref={modalRef}
        onMouseDown={(e) => e.target === modalRef.current && handleClose()}
        className="relative grid size-full place-items-center overflow-hidden"
      >
        <button
          type="button"
          onClick={() => handleClose(true)}
          className="absolute top-10 right-10 grid size-8 place-items-center"
          aria-label={translate("web.close_image_viewer")}
        >
          <CloseOutline className="size-8 text-white/60 transition-colors hover:text-white" />
        </button>
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions react-doctor/no-noninteractive-element-interactions -- Mousedown starts coordinate-based panning only for oversized images; the image retains its semantics, while zoom and close have buttons and keyboard shortcuts. */}
        <img
          onMouseDown={handleMouseDown}
          ref={setImageRef}
          src={src}
          alt={translate("web.image")}
          className="read-only-image rounded-lg"
          style={{
            width: `${widthInNumber * initialMagnification}px`,
            maxWidth: "none",
            maxHeight: "none",
            aspectRatio,
            position: "relative",
            transform: `scale(${magnification})`,
            transformOrigin: "center",
            transition: "width 0.2s ease, transform 0.2s ease",
          }}
        />
        <div className="fixed bottom-10 left-1/2 flex -translate-x-1/2 items-center justify-center gap-1 divide-x divide-subtle-1 rounded-md border border-subtle-1 bg-black py-2">
          <div className="flex items-center">
            <button
              type="button"
              onClick={(e) => {
                if (isTouchDevice) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                handleMagnification("decrease");
              }}
              className="grid size-6 place-items-center text-white/60 transition-colors duration-200 hover:text-white disabled:text-white/30"
              disabled={magnification <= MIN_ZOOM}
              aria-label={translate("web.zoom_out")}
            >
              <MinusOutline className="size-4" />
            </button>
            <span className="w-12 text-center text-13 text-white">{Math.round(100 * magnification)}%</span>
            <button
              type="button"
              onClick={(e) => {
                if (isTouchDevice) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                handleMagnification("increase");
              }}
              className="grid size-6 place-items-center text-white/60 transition-colors duration-200 hover:text-white disabled:text-white/30"
              disabled={magnification >= MAX_ZOOM}
              aria-label={translate("web.zoom_in")}
            >
              <AddOutline className="size-4" />
            </button>
          </div>
          {!isTouchDevice && (
            <button
              type="button"
              onClick={() => window.open(downloadSrc, "_blank", "noopener,noreferrer")}
              className="grid size-8 flex-shrink-0 place-items-center text-white/60 transition-colors duration-200 hover:text-white"
              aria-label={translate("web.download_image")}
            >
              <DownloadOutline className="size-4" />
            </button>
          )}
          {!isTouchDevice && (
            <button
              type="button"
              onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
              className="grid size-8 flex-shrink-0 place-items-center text-white/60 transition-colors duration-200 hover:text-white"
              aria-label={translate("web.open_image_in_new_tab")}
            >
              <NewTabOutline className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImageFullScreenModal(props: Props) {
  let modal = <ImageFullScreenModalWithoutPortal {...props} />;
  const portal = document.querySelector("#editor-portal");
  if (portal) {
    modal = ReactDOM.createPortal(modal, portal);
  } else {
    console.warn("Portal element #editor-portal not found. Rendering in document.body");
    if (typeof document !== "undefined" && document.body) {
      modal = ReactDOM.createPortal(modal, document.body);
    }
  }
  return modal;
}
