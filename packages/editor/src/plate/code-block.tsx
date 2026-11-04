import { useState } from "react";
import { MermaidDiagram } from "./mermaid-diagram";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { CheckIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { NodeApi } from "platejs";
import { PlateElement, useReadOnly, type PlateElementProps } from "platejs/react";
// oxlint-disable-next-line import/no-unassigned-import -- Scoped upstream highlight.js themes.
import "./code-theme.css";
// oxlint-disable-next-line import/no-unassigned-import -- Scoped code block controls.
import "./code-block.css";

export function ComparisonCodeBlock(props: PlateElementProps) {
  const { editor, element } = props;
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const language = typeof element.lang === "string" && element.lang ? element.lang : "plaintext";
  const languages = editor.getOptions(CodeBlockPlugin).lowlight?.listLanguages() ?? [];
  const items = [...new Set(["plaintext", "mermaid", ...languages, language])].map((value) => ({
    value,
    label: value === "plaintext" ? t("web.plain_text") : value,
  }));
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(element.children.map((line) => NodeApi.string(line)).join("\n"));
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy code block", error);
      setCopyStatus("error");
    }
  };

  const code = (
    <pre className="plate-github-code">
      <code className={`language-${language}`}>{props.children}</code>
    </pre>
  );
  return (
    <PlateElement {...props} className="plane-code-block" data-menu-open={menuOpen || undefined}>
      <div className="plane-code-block-controls" contentEditable={false} onBlur={() => setCopyStatus("idle")}>
        {readOnly ? (
          <span className="plane-code-block-language">{items.find((item) => item.value === language)?.label}</span>
        ) : (
          <Select<string>
            items={items}
            value={language}
            onOpenChange={setMenuOpen}
            onValueChange={(lang) => {
              const at = editor.api.findPath(element);
              if (lang && at) editor.tf.setNodes({ lang }, { at });
            }}
          >
            <SelectTrigger size="md" variant="ghost" width="fit" aria-label={t("language")} />
            <SelectContent
              finalFocus={() => {
                editor.tf.focus();
                return false;
              }}
            >
              <SelectList>
                {items.map((item) => (
                  <SelectItem key={item.value} {...item} />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
        )}
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          icon={copyStatus === "copied" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          aria-label={t("web.copy_code")}
          onClick={() => void copyCode()}
        />
        {!readOnly && (
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            icon={<Trash2Icon className="size-3.5" />}
            aria-label={t("delete")}
            onClick={() => {
              const at = editor.api.findPath(element);
              if (at) editor.tf.removeNodes({ at });
              editor.tf.focus();
            }}
          />
        )}
        <output className={copyStatus === "error" ? "plane-code-block-error" : "sr-only"}>
          {copyStatus === "copied" ? t("web.copied") : copyStatus === "error" ? t("web.page_copy_failed") : ""}
        </output>
      </div>
      {language === "mermaid" ? <MermaidDiagram element={element}>{code}</MermaidDiagram> : code}
    </PlateElement>
  );
}
