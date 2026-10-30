import { createPlatePlugin, PlateElement, type PlateElementProps } from "platejs/react";
import { useSandboxAssetsContext } from "./image-plugin";
import { useAssetUrl } from "./assets";
import { sanitizeHtml } from "../plate-headless";
function Attachment({ id, name }: { id: string; name: string }) {
  const assets = useSandboxAssetsContext();
  const url = useAssetUrl(assets, id);
  return url ? (
    <a href={url} download={name} target="_blank" rel="noopener noreferrer">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}

function OpaqueElement(props: PlateElementProps) {
  const html = sanitizeHtml(String(props.element.html ?? ""));
  const attachment =
    typeof DOMParser !== "undefined"
      ? new DOMParser().parseFromString(html, "text/html").querySelector("file-component, attachment-component")
      : null;
  return (
    <PlateElement {...props} as={props.element.type === "html_opaque_inline" ? "span" : "div"}>
      {attachment ? (
        <span contentEditable={false}>
          <Attachment
            id={attachment.getAttribute("src") ?? attachment.getAttribute("asset_id") ?? ""}
            name={attachment.getAttribute("name") ?? attachment.textContent ?? ""}
          />
        </span>
      ) : (
        <span contentEditable={false} dangerouslySetInnerHTML={{ __html: html }} />
      )}
      {props.children}
    </PlateElement>
  );
}
export const opaquePlugins = [
  createPlatePlugin({ key: "html_opaque", node: { isElement: true, isVoid: true, component: OpaqueElement } }),
  createPlatePlugin({
    key: "html_opaque_inline",
    node: { isElement: true, isInline: true, isVoid: true, component: OpaqueElement },
  }),
];
