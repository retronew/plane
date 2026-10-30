import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createCallable, type PropsWithCall } from "react-call";
import { Dialog } from "@base-ui/react/dialog";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { XIcon } from "lucide-react";
import { ElementApi, type Descendant } from "platejs";
import { type EditorAssets as SandboxAssets } from "./assets";

export type ImageLightboxLabels = {
  preview: string;
  previousImage: string;
  nextImage: string;
  closePreview: string;
  imagePosition: string;
};
export type LightboxImage = { src: string; alt: string; description: string; path: string };

// Walk descendants, including images inside tables and callouts, in document order.
export function collectDocumentImages(
  nodes: Descendant[],
  assets: SandboxAssets,
  parent: number[] = []
): LightboxImage[] {
  return nodes.flatMap((node, index) => {
    if (!ElementApi.isElement(node)) return [];
    const path = [...parent, index];
    if (node.type === "sandboxImage") {
      const src = typeof node.src === "string" ? assets.get(node.src) : undefined;
      return src
        ? [
            {
              src,
              alt: String(node.alt ?? ""),
              description: String(node.title || node.alt || ""),
              path: path.join("."),
            },
          ]
        : [];
    }
    return collectDocumentImages(node.children, assets, path);
  });
}

type LightboxProps = {
  images: LightboxImage[];
  initialIndex: number;
  labels: ImageLightboxLabels;
  returnFocus: HTMLElement | null;
};
function ImageLightbox({
  call,
  images,
  initialIndex,
  labels,
  returnFocus,
}: PropsWithCall<LightboxProps, void, object>) {
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(true);
  const image = images[index];
  const activeThumbnail = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const thumbnail = activeThumbnail.current;
    if (thumbnail?.dataset.index === String(index)) thumbnail.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [index]);
  const navigate = (direction: number) => setIndex((current) => (current + direction + images.length) % images.length);
  const position = labels.imagePosition.replace("{index}", String(index + 1)).replace("{total}", String(images.length));
  return (
    <Dialog.Root
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        // End the callable only after the primitive's exit transition finishes.
        if (!isOpen) call.end();
      }}
    >
      <Dialog.Portal data-prevent-outside-click>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/85 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          aria-label={labels.preview}
          finalFocus={() => (returnFocus?.isConnected ? returnFocus : false)}
          className="fixed inset-0 z-[101] flex h-dvh flex-col items-center gap-4 px-4 pt-14 pb-5 text-white transition-opacity duration-200 outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none sm:px-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              event.stopPropagation();
              navigate(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          <div className="absolute top-4 right-4 [&_button]:text-white [&_button:hover]:bg-white/15 [&_button:hover]:text-white">
            <IconButton
              variant="ghost"
              size="lg"
              aria-label={labels.closePreview}
              icon={<XIcon className="size-5" />}
              onClick={() => setOpen(false)}
            />
          </div>
          <div className="pointer-events-none flex min-h-0 w-full flex-1 items-center justify-center">
            <img
              data-testid="lightbox-current-image"
              src={image.src}
              alt={image.alt}
              className="pointer-events-auto block max-h-full max-w-full object-contain"
            />
          </div>
          <div className="max-w-full shrink-0 overflow-x-auto p-1">
            <div className="flex w-max gap-2">
              {images.map((item, thumbnailIndex) => (
                <button
                  key={item.path}
                  data-index={thumbnailIndex}
                  ref={thumbnailIndex === index ? activeThumbnail : undefined}
                  type="button"
                  aria-label={
                    item.alt ||
                    labels.imagePosition
                      .replace("{index}", String(thumbnailIndex + 1))
                      .replace("{total}", String(images.length))
                  }
                  aria-pressed={thumbnailIndex === index}
                  onClick={() => setIndex(thumbnailIndex)}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded border-2 bg-black/30 transition-[opacity,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${thumbnailIndex === index ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-100"}`}
                >
                  <img src={item.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {position}
          </span>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Scoped to the sandbox provider: two documents may coexist without sharing a callable root.
const LightboxContext = createContext<ReturnType<typeof createImageLightbox> | null>(null);
const createImageLightbox = () => createCallable<LightboxProps, void>(ImageLightbox);
export function ImageLightboxProvider({ children }: { children: ReactNode }) {
  const [Lightbox] = useState(createImageLightbox);
  return (
    <LightboxContext.Provider value={Lightbox}>
      {children}
      <Lightbox />
    </LightboxContext.Provider>
  );
}
export function useImageLightbox() {
  const lightbox = useContext(LightboxContext);
  if (!lightbox) throw new Error("ImageLightboxProvider is required");
  return lightbox;
}
