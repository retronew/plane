import { useId, useRef, useState } from "react";
import { EquationPlugin, InlineEquationPlugin, useEquationElement, useEquationInput } from "@platejs/math/react";
import { Button } from "@makeplane/propel/components/button";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { TextArea, TextAreaGroup } from "@makeplane/propel/elements/text-area";
import { useTranslation } from "@plane/i18n";
import type { TEquationElement } from "platejs";
import { PlateElement, type PlateElementProps, useReadOnly } from "platejs/react";
// oxlint-disable-next-line import/no-unassigned-import -- Scoped equation presentation; KaTeX CSS is supplied by the official plugin.
import "./math.css";

function EquationInput({ isInline, close }: { isInline: boolean; close: () => void }) {
  const { t } = useTranslation();
  const inputId = useId();
  const { props: inputProps, ref: inputRef, onSubmit } = useEquationInput({ isInline, open: true, onClose: close });
  return (
    <div className="plane-equation-input ignore-click-outside/toolbar">
      <label htmlFor={inputId}>
        <span className="text-xs text-secondary">LaTeX</span>
        <TextAreaGroup resize="vertical">
          <TextArea {...inputProps} ref={inputRef} id={inputId} aria-label="LaTeX" rows={3} size="md" surface="field" />
        </TextAreaGroup>
      </label>
      <div className="flex justify-end">
        <Button type="button" stretch="auto" size="sm" variant="primary" label={t("save")} onClick={onSubmit} />
      </div>
    </div>
  );
}

function EquationPreview({ element, inline }: { element: TEquationElement; inline: boolean }) {
  const katexRef = useRef<HTMLDivElement>(null);
  useEquationElement({
    element,
    katexRef,
    options: { displayMode: !inline, throwOnError: false, trust: false, maxExpand: 1000, maxSize: 20 },
  });
  return <span ref={katexRef} className="plane-equation-render" />;
}

function EquationElement(props: PlateElementProps<TEquationElement> & { inline?: boolean }) {
  const { inline = false, ...elementProps } = props;
  const { element, editor } = elementProps;
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const rendered = <EquationPreview element={element} inline={inline} />;
  return (
    <PlateElement
      {...elementProps}
      as={inline ? "span" : "div"}
      className={inline ? "plane-equation plane-equation-inline" : "plane-equation"}
      data-slate-tex-expression={element.texExpression}
    >
      {props.children}
      <span contentEditable={false}>
        {readOnly ? (
          rendered
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <ButtonElement type="button" stretch="auto" variant="ghost" size="md" aria-label={`${t("edit")} LaTeX`}>
                  {rendered}
                  {!element.texExpression && <span className="text-tertiary">LaTeX</span>}
                </ButtonElement>
              }
            />
            <PopoverContent
              side="bottom"
              align="start"
              finalFocus={() => {
                editor.tf.focus();
                return false;
              }}
            >
              {open && <EquationInput isInline={inline} close={() => setOpen(false)} />}
            </PopoverContent>
          </Popover>
        )}
      </span>
    </PlateElement>
  );
}

export function BlockEquationElement(props: PlateElementProps<TEquationElement>) {
  return <EquationElement {...props} />;
}

export function InlineEquationElement(props: PlateElementProps<TEquationElement>) {
  return <EquationElement {...props} inline />;
}

export const comparisonMathPlugins = [
  EquationPlugin.withComponent(BlockEquationElement),
  InlineEquationPlugin.withComponent(InlineEquationElement),
];
