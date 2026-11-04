import {
  BlockquoteRules,
  BoldRules,
  CodeRules,
  HeadingRules,
  ItalicRules,
  StrikethroughRules,
} from "@platejs/basic-nodes";
import { CodeBlockRules } from "@platejs/code-block";
import { BulletedListRules, OrderedListRules, TaskListRules } from "@platejs/list";
import {
  createBlockStartInputRule,
  KEYS,
  type InputRulesConfig,
  type InsertTextInputRuleContext,
  type InsertBreakInputRuleContext,
  type InsertDataInputRuleContext,
  type SelectionInputRuleContext,
} from "platejs";
import { comparisonPlugins } from "./plate-kit";
import { isPlateFeatureDisabled } from "./capabilities";

type MarkdownInputRule = InputRulesConfig[number];

/** Plate 53 replaces the inert AutoformatPlugin with feature-owned input rules. */
export function createMarkdownInputPlugins(disabled: () => readonly string[]) {
  const guard = (feature: string, rule: MarkdownInputRule, ...dependencies: string[]): MarkdownInputRule => {
    const allowed = ({ editor }: SelectionInputRuleContext) =>
      ![feature, ...dependencies].some((key) => isPlateFeatureDisabled(disabled(), key)) &&
      !editor.api.some({ match: { type: editor.getType(KEYS.codeBlock) } });
    // Preserve each official rule's context-specific safety checks.
    if (rule.target === "insertText")
      return {
        ...rule,
        enabled: (context: InsertTextInputRuleContext) => allowed(context) && (rule.enabled?.(context) ?? true),
      };
    if (rule.target === "insertBreak")
      return {
        ...rule,
        enabled: (context: InsertBreakInputRuleContext) => allowed(context) && (rule.enabled?.(context) ?? true),
      };
    return {
      ...rule,
      enabled: (context: InsertDataInputRuleContext) => allowed(context) && (rule.enabled?.(context) ?? true),
    };
  };
  const uncheckedTask = TaskListRules.markdown();
  const rules: Record<string, MarkdownInputRule[]> = {
    ...Object.fromEntries(
      [KEYS.h1, KEYS.h2, KEYS.h3, KEYS.h4, KEYS.h5, KEYS.h6].map((key) => [
        key,
        [guard("heading", HeadingRules.markdown())],
      ])
    ),
    [KEYS.bold]: ["*", "_"].map((variant) =>
      guard("bold", BoldRules.markdown({ variant: variant as "*" | "_", priority: 100 }))
    ),
    [KEYS.italic]: ["*", "_"].map((variant) =>
      guard("italic", ItalicRules.markdown({ variant: variant as "*" | "_" }))
    ),
    [KEYS.strikethrough]: [guard("strikethrough", StrikethroughRules.markdown())],
    [KEYS.code]: [guard("code", CodeRules.markdown())],
    [KEYS.blockquote]: [guard("blockquote", BlockquoteRules.markdown())],
    [KEYS.codeBlock]: [guard("codeBlock", CodeBlockRules.markdown({ on: "break" }))],
    [KEYS.list]: [
      guard("bulletList", BulletedListRules.markdown({ variant: "-" }), "listItem"),
      guard("bulletList", BulletedListRules.markdown({ variant: "*" }), "listItem"),
      guard("orderedList", OrderedListRules.markdown({ variant: "." }), "listItem"),
      guard("orderedList", OrderedListRules.markdown({ variant: ")" }), "listItem"),
      guard("todoList", uncheckedTask),
      // The official task factory only matches []; reuse its transform for [ ].
      ...(uncheckedTask.target === "insertText"
        ? [
            guard(
              "todoList",
              createBlockStartInputRule({
                match: "[ ]",
                trigger: " ",
                enabled: uncheckedTask.enabled,
                apply: uncheckedTask.apply,
              })
            ),
          ]
        : []),
      guard("todoList", TaskListRules.markdown({ checked: true })),
    ],
  };
  return comparisonPlugins.map((plugin) =>
    rules[plugin.key] ? plugin.extend({ inputRules: rules[plugin.key] }) : plugin
  );
}
