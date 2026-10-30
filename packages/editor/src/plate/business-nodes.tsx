import { createElement, useContext } from "react";
import { PlateMentionContext } from "./mentions";
import type { TCallbackMentionComponentProps } from "../types";
import type { ReactNode } from "react";
import { createSlatePlugin } from "platejs";
import { toPlatePlugin } from "platejs/react";

type NodeProps = { attributes: Record<string, unknown>; children?: ReactNode; element: Record<string, unknown> };
const mentionAttributes = ["id", "entity_identifier", "entity_name"] as const;
const calloutAttributes = [
  "id",
  "data-icon-color",
  "data-icon-name",
  "data-emoji-unicode",
  "data-emoji-url",
  "data-logo-in-use",
  "data-background",
  "data-block-type",
] as const;
function attributesFrom(element: HTMLElement, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, element.getAttribute(key)]).filter(([, value]) => value !== null));
}
export function ComparisonMention({ attributes, children, element }: NodeProps) {
  const handler = useContext(PlateMentionContext);
  const props = {
    entity_identifier: String(element.entity_identifier ?? ""),
    entity_name: element.entity_name as TCallbackMentionComponentProps["entity_name"],
  };
  return (
    <span {...attributes} contentEditable={false} className="rounded bg-layer-2 px-1 text-accent-primary">
      {handler
        ? handler.renderComponent(props)
        : `@${String(element.label ?? element.id ?? element.entity_identifier ?? "")}`}
      {children}
    </span>
  );
}
export function ComparisonMentionStatic({ element }: NodeProps) {
  return createElement("mention-component", Object.fromEntries(mentionAttributes.map((key) => [key, element[key]])));
}
export function ComparisonCallout({ attributes, children, element }: NodeProps) {
  return (
    <div
      {...attributes}
      {...Object.fromEntries(calloutAttributes.map((key) => [key, element[key]]))}
      className="my-3 rounded-md border border-subtle bg-layer-1 px-4 py-3"
    >
      {children}
    </div>
  );
}
export const BaseComparisonMentionPlugin = createSlatePlugin({
  key: "comparison_mention",
  node: { isElement: true, isInline: true, isVoid: true, component: ComparisonMentionStatic },
  parsers: {
    html: {
      deserializer: {
        rules: [{ validNodeName: "MENTION-COMPONENT" }],
        parse: ({ element }) => ({
          type: "comparison_mention",
          ...attributesFrom(element, mentionAttributes),
          children: [{ text: "" }],
        }),
      },
    },
  },
});
export const ComparisonMentionPlugin = toPlatePlugin(BaseComparisonMentionPlugin).withComponent(ComparisonMention);
export const BaseComparisonCalloutPlugin = createSlatePlugin({
  key: "comparison_callout",
  node: { isElement: true, component: ComparisonCallout },
  parsers: {
    html: {
      deserializer: {
        rules: [{ validNodeName: "DIV", validAttribute: { "data-block-type": "callout-component" } }],
        parse: ({ element }) => ({ type: "comparison_callout", ...attributesFrom(element, calloutAttributes) }),
      },
    },
  },
});
export const ComparisonCalloutPlugin = toPlatePlugin(BaseComparisonCalloutPlugin);
