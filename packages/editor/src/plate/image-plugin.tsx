import { createContext, createElement, useContext, useState, type ReactNode } from "react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { AlignLeftIcon, AlignCenterIcon, AlignRightIcon, ExpandIcon, Trash2Icon } from "lucide-react";
import { BaseImagePlugin } from "@platejs/media";
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from "@platejs/floating";
import { useMediaState } from "@platejs/media/react";
import { Resizable, ResizableProvider, ResizeHandle } from "@platejs/resizable";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { type SlateEditor, type SlatePlugin, type TElement } from "platejs";
import {
  PlateElement,
  toPlatePlugin,
  useEditorSelector,
  useFocusedLast,
  withHOC,
  type PlateElementProps,
} from "platejs/react";
import { type EditorAssets as SandboxAssets, useAssetUrl } from "./assets";
import {
  collectDocumentImages,
  ImageLightboxProvider,
  useImageLightbox,
  type ImageLightboxLabels,
} from "./image-lightbox";

export type SandboxImageLabels = ImageLightboxLabels & {
  upload: string;
  width: string;
  alt: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  remove: string;
  preview: string;
  unavailable: string;
  uploadError: string;
};
const defaultLabels: SandboxImageLabels = {
  previousImage: "Previous image",
  nextImage: "Next image",
  closePreview: "Close preview",
  imagePosition: "{index} of {total}",
  upload: "Upload image",
  width: "Image width",
  alt: "Alternative text",
  alignLeft: "Align left",
  alignCenter: "Align center",
  alignRight: "Align right",
  remove: "Delete image",
  preview: "Preview image",
  unavailable: "Image is unavailable",
  uploadError: "Select an image of 5 MB or smaller",
};
const AssetsContext = createContext<SandboxAssets | null>(null);
const LabelsContext = createContext(defaultLabels);
export function SandboxAssetsProvider({
  assets,
  labels = defaultLabels,
  children,
}: {
  assets: SandboxAssets;
  labels?: SandboxImageLabels;
  children: ReactNode;
}) {
  return (
    <AssetsContext.Provider value={assets}>
      <LabelsContext.Provider value={labels}>
        <ImageLightboxProvider>{children}</ImageLightboxProvider>
      </LabelsContext.Provider>
    </AssetsContext.Provider>
  );
}
export function useSandboxAssetsContext() {
  const assets = useContext(AssetsContext);
  if (!assets) throw new Error("SandboxAssetsProvider is required");
  return assets;
}

export type SandboxImageNode = TElement & {
  src: string;
  alt?: string;
  title?: string;
  width?: string | number;
  height?: string;
  alignment?: "left" | "center" | "right";
  aspectRatio?: string;
  id?: string;
};
const dimension = (value: unknown, fallback: string): string =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value}px`
    : typeof value === "string" && /^(?:\d+(?:\.\d+)?(?:px|%)?|auto)$/.test(value)
      ? /^\d+(?:\.\d+)?$/.test(value)
        ? `${value}px`
        : value
      : fallback;
const alignment = (value: unknown) => (value === "center" || value === "right" ? value : "left");

export function SandboxImageStaticElement({ element }: { element: TElement }) {
  const image = element as SandboxImageNode;
  return createElement("image-component", {
    src: image.src,
    alt: image.alt ?? "",
    title: image.title,
    width: dimension(image.width, "35%"),
    height: typeof image.width === "number" ? "auto" : dimension(image.height, "auto"),
    alignment: alignment(image.alignment),
    aspectratio: image.aspectRatio,
    id: image.id,
    status: "uploaded",
  });
}

export const BaseSandboxImagePlugin = (BaseImagePlugin as unknown as SlatePlugin).extend({
  key: "sandboxImage",
  options: { disableEmbedInsert: true, disableUploadInsert: true },
  node: { type: "sandboxImage", isElement: true, isVoid: true, component: SandboxImageStaticElement },
  parsers: {
    html: {
      deserializer: {
        rules: [{ validNodeName: "IMAGE-COMPONENT" }, { validNodeName: "IMG" }],
        parse: ({ element, type }) => ({
          type,
          src: element.getAttribute("src") ?? "",
          alt: element.getAttribute("alt") ?? "",
          title: element.getAttribute("title") ?? undefined,
          width: dimension(element.getAttribute("width") ?? element.style.width, "35%"),
          height: dimension(element.getAttribute("height") ?? element.style.height, "auto"),
          alignment: alignment(element.getAttribute("alignment")),
          aspectRatio: element.getAttribute("aspectratio") ?? undefined,
          id: element.getAttribute("id") ?? undefined,
        }),
      },
    },
  },
});

// Official v53 image-node composition, adapting asset IDs instead of storing URLs.
export const SandboxImageElement = withHOC(ResizableProvider, function SandboxImageElement(props: PlateElementProps) {
  const { element, editor } = props;
  const image = element as SandboxImageNode;
  const assets = useSandboxAssetsContext();
  const labels = useContext(LabelsContext);
  const lightbox = useImageLightbox();
  const [error, setError] = useState("");
  const { selected, readOnly } = useMediaState();
  const focusedLast = useFocusedLast();
  const collapsed = useEditorSelector((currentEditor) => !currentEditor.api.isExpanded(), []);
  const showToolbar = selected && focusedLast && collapsed && !readOnly;
  const { refs, floatingStyles } = useFloating({
    open: showToolbar,
    placement: "top",
    strategy: "fixed",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const src = useAssetUrl(assets, image.src);
  const preview = () => {
    const images = collectDocumentImages(editor.children, assets);
    const path = editor.api.findPath(element)?.join(".");
    const initialIndex = images.findIndex((item) => item.path === path);
    if (initialIndex < 0) return;
    // The image button survives when editor focus hides the floating toolbar.
    const returnFocus = refs.reference.current instanceof HTMLElement ? refs.reference.current.closest("button") : null;
    void lightbox.upsert({ images, initialIndex, labels, returnFocus });
  };
  const update = (patch: Partial<SandboxImageNode>) => {
    const at = editor.api.findPath(element);
    if (at) editor.tf.setNodes(patch, { at });
  };
  const remove = async () => {
    try {
      // Removing a node must not delete an asset still referenced by peers or undo history.
      const at = editor.api.findPath(element);
      if (at) editor.tf.withNewBatch(() => editor.tf.removeNodes({ at, voids: true }));
    } catch {
      setError(labels.unavailable);
    }
  };
  return (
    <PlateElement {...props} className="my-3">
      <div contentEditable={false}>
        <Resizable
          options={{ align: alignment(image.alignment), readOnly }}
          className={image.alignment === "center" ? "mx-auto" : image.alignment === "right" ? "ml-auto" : "mr-auto"}
        >
          {src ? (
            <button
              type="button"
              className="focus-visible:ring-offset-surface-1 block w-full cursor-pointer rounded-md border-0 bg-transparent p-0 text-left leading-none outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/50 focus-visible:ring-offset-2"
              onDoubleClick={preview}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (readOnly) return;
                const at = editor.api.findPath(element);
                if (at) editor.tf.select(at);
                editor.tf.focus();
              }}
            >
              <img
                ref={refs.setReference}
                src={src}
                alt={image.alt ?? ""}
                title={image.title}
                draggable={false}
                className={`block w-full max-w-full rounded-md transition-shadow duration-150 motion-reduce:transition-none ${selected ? "ring-2 ring-accent-strong/50" : ""}`}
                style={{ height: typeof image.width === "number" ? "auto" : dimension(image.height, "auto") }}
              />
            </button>
          ) : (
            <output>{labels.unavailable}</output>
          )}
          {showToolbar &&
            src &&
            (["left", "right"] as const).map((direction) => (
              <ResizeHandle
                key={direction}
                options={{ direction }}
                data-image-resize-handle={direction}
                className={`absolute top-1/2 h-10 w-2 -translate-y-1/2 cursor-ew-resize rounded border border-strong bg-layer-1 ${direction === "left" ? "-left-1" : "-right-1"}`}
              />
            ))}
        </Resizable>
        {showToolbar && (
          <FloatingPortal>
            <fieldset
              ref={refs.setFloating}
              style={floatingStyles}
              data-testid="image-floating-toolbar"
              data-prevent-outside-click
              contentEditable={false}
              className="ignore-click-outside/toolbar z-50 flex w-max max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-lg border border-subtle bg-surface-1 p-1 shadow-raised-200 [&>div]:w-28 [&>div:nth-of-type(2)]:w-40"
              aria-label={labels.upload}
            >
              <InputGroup size="md">
                <Input
                  size="md"
                  aria-label={labels.width}
                  key={image.width}
                  defaultValue={dimension(image.width, "35%")}
                  onBlur={(event) => update({ width: dimension(event.target.value, "35%"), height: "auto" })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </InputGroup>
              <InputGroup size="md">
                <Input
                  size="md"
                  aria-label={labels.alt}
                  value={image.alt ?? ""}
                  onChange={(event) => update({ alt: event.target.value })}
                />
              </InputGroup>
              {(["left", "center", "right"] as const).map((value) => {
                const label =
                  value === "left" ? labels.alignLeft : value === "center" ? labels.alignCenter : labels.alignRight;
                const Icon = value === "left" ? AlignLeftIcon : value === "center" ? AlignCenterIcon : AlignRightIcon;
                return (
                  <IconButton
                    key={value}
                    type="button"
                    size="sm"
                    variant={alignment(image.alignment) === value ? "tertiary" : "ghost"}
                    aria-pressed={alignment(image.alignment) === value}
                    aria-label={label}
                    icon={<Icon className="size-4" />}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => update({ alignment: value })}
                  />
                );
              })}
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                aria-label={labels.preview}
                icon={<ExpandIcon className="size-4" />}
                disabled={!src}
                onMouseDown={(event) => event.preventDefault()}
                onClick={preview}
              />
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                aria-label={labels.remove}
                icon={<Trash2Icon className="size-4" />}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void remove()}
              />
            </fieldset>
          </FloatingPortal>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      {props.children}
    </PlateElement>
  );
});
export const SandboxImagePlugin = toPlatePlugin(BaseSandboxImagePlugin, { node: { component: SandboxImageElement } });

export async function insertSandboxImage(editor: SlateEditor, assets: SandboxAssets, file: File): Promise<void> {
  const id = crypto.randomUUID();
  const src = await assets.upload(id, file);
  editor.tf.insertNodes({
    type: BaseSandboxImagePlugin.key,
    id,
    src,
    alt: file.name,
    width: "35%",
    height: "auto",
    alignment: "left",
    children: [{ text: "" }],
  });
}
