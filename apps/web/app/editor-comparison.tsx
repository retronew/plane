import { ComparisonRoomControls, useComparisonRoom } from "@/components/editor/comparison/collaboration-room";
import { observer } from "mobx-react";
import { comparisonRoomName, comparisonRemoteAssets } from "@/components/editor/comparison/collaboration";
import { useMemo, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { TextArea } from "@makeplane/propel/components/text-area";
import type { EditorRefApi, TDisplayConfig } from "@plane/editor";
import { SandboxAssetsProvider } from "@/components/editor/comparison/image-plugin";
import { useSandboxAssets } from "@/components/editor/comparison/sandbox-assets";
import { useTranslation } from "@plane/i18n";
import { LegacyComparisonEditor } from "@/components/editor/comparison/legacy-editor";
import { PlateComparisonEditor } from "@/components/editor/comparison/plate-editor";
import { COMPARISON_SAMPLE, FULL_COMPARISON_SAMPLE } from "@/components/editor/comparison/sample";

type PlateHandle = {
  getHtml: () => Promise<string>;
  setHtml: (html: string) => void;
  setMarkdown: (markdown: string) => void;
};
const additionalLabels = [
  "heading3",
  "heading4",
  "heading5",
  "heading6",
  "bulletedList",
  "numberedList",
  "todoList",
  "indent",
  "outdent",
  "link",
  "linkUrl",
  "apply",
  "unlink",
  "table",
  "insertRow",
  "insertColumn",
  "deleteRow",
  "deleteColumn",
  "deleteTable",
  "codeBlock",
  "horizontalRule",
  "alignLeft",
  "alignCenter",
  "alignRight",
  "alignJustify",
  "textColor",
  "backgroundColor",
  "clearColor",
  "callout",
  "image",
  "uploadFailed",
] as const;
const imageLabels = [
  "upload",
  "width",
  "alt",
  "alignLeft",
  "alignCenter",
  "alignRight",
  "remove",
  "preview",
  "previousImage",
  "nextImage",
  "closePreview",
  "unavailable",
  "uploadError",
] as const;

function EditorComparisonPage() {
  const { t } = useTranslation();
  const roomControls = useComparisonRoom();
  const { collaboration } = roomControls;
  const remoteAssets = useMemo(
    () =>
      collaboration && typeof window !== "undefined"
        ? comparisonRemoteAssets(collaboration, window.location.origin)
        : undefined,
    [collaboration]
  );
  const { assets, fileHandler } = useSandboxAssets(remoteAssets);
  const [displayConfig, setDisplayConfig] = useState<TDisplayConfig>({
    fontSize: "small-font",
    fontStyle: "sans-serif",
    lineSpacing: "regular",
  });
  const [markdown, setMarkdown] = useState(
    "## Markdown 测试\n\n**粗体** 和 _斜体_\n\n- 第一项\n- 第二项\n\n```js\nconst ready = true;\n```"
  );
  const legacy = useRef<EditorRefApi>(null);
  const plate = useRef<PlateHandle>(null);
  const [source, setSource] = useState(COMPARISON_SAMPLE);
  const [outputs, setOutputs] = useState<{ tiptap: string; plate: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"success" | "error" | null>(null);

  const run = async (action: () => void | Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setStatus("success");
    } catch (error) {
      console.error("Editor comparison conversion failed", error);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };
  const load = (html: string) => {
    plate.current?.setHtml(html);
    legacy.current?.setEditorValue(html, true);
    setOutputs(null);
  };

  return (
    <SandboxAssetsProvider
      assets={assets}
      labels={{
        ...(Object.fromEntries(imageLabels.map((key) => [key, t(`editor_comparison.${key}`)])) as Record<
          (typeof imageLabels)[number],
          string
        >),
        imagePosition: t("editor_comparison.imagePosition", { index: "{index}", total: "{total}" }),
      }}
    >
      <div className="h-full overflow-auto">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-8">
          <header className="space-y-2">
            <h1 className="text-24 font-semibold text-primary">{t("editor_comparison.title")}</h1>
            <p className="max-w-4xl text-14 text-secondary">{t("editor_comparison.intro")}</p>
          </header>
          <ComparisonRoomControls controls={roomControls} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              stretch="auto"
              variant="secondary"
              label={t("editor_comparison.richSample")}
              disabled={busy}
              onClick={() =>
                void run(() => {
                  setSource(FULL_COMPARISON_SAMPLE);
                  load(FULL_COMPARISON_SAMPLE);
                })
              }
            />
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              label={t("editor_comparison.sample")}
              disabled={busy}
              onClick={() =>
                void run(() => {
                  setSource(COMPARISON_SAMPLE);
                  load(COMPARISON_SAMPLE);
                })
              }
            />
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              label={t("editor_comparison.to_plate")}
              disabled={busy}
              onClick={() =>
                void run(() => {
                  plate.current?.setHtml(legacy.current?.getDocument().html ?? "");
                  setOutputs(null);
                })
              }
            />
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              label={t("editor_comparison.to_tiptap")}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const html = await plate.current?.getHtml();
                  if (html !== undefined) legacy.current?.setEditorValue(html, true);
                  setOutputs(null);
                })
              }
            />
            <Button
              variant="primary"
              size="sm"
              stretch="auto"
              label={t("editor_comparison.export")}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const html = await plate.current?.getHtml();
                  if (html !== undefined) setOutputs({ tiptap: legacy.current?.getDocument().html ?? "", plate: html });
                })
              }
            />
          </div>
          <p className="text-13 text-secondary">{t("editor_comparison.replace_note")}</p>
          <output aria-live="polite" className={status === "error" ? "text-danger-primary" : "text-secondary"}>
            {status ? t(`editor_comparison.${status}`) : null}
          </output>
          <p className="text-13 text-secondary">{t("editor_comparison.sandbox_note")}</p>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-14 font-medium">{t("editor_comparison.style")}</legend>
            {(
              [
                ["small-font", "smallFont"],
                ["large-font", "largeFont"],
              ] as const
            ).map(([fontSize, label]) => (
              <Button
                key={fontSize}
                size="sm"
                stretch="auto"
                variant={displayConfig.fontSize === fontSize ? "primary" : "secondary"}
                label={t(`editor_comparison.${label}`)}
                onClick={() => setDisplayConfig((current) => ({ ...current, fontSize }))}
              />
            ))}
            {(
              [
                ["sans-serif", "sansSerif"],
                ["serif", "serif"],
                ["monospace", "monospace"],
              ] as const
            ).map(([fontStyle, label]) => (
              <Button
                key={fontStyle}
                size="sm"
                stretch="auto"
                variant={displayConfig.fontStyle === fontStyle ? "primary" : "secondary"}
                label={t(`editor_comparison.${label}`)}
                onClick={() => setDisplayConfig((current) => ({ ...current, fontStyle }))}
              />
            ))}
          </fieldset>
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <section aria-labelledby="tiptap-title" className="min-w-0 rounded-lg border border-subtle bg-surface-1">
              <h2 id="tiptap-title" className="border-b border-subtle px-5 py-4 text-16 font-semibold">
                {t("editor_comparison.current")}
              </h2>
              <LegacyComparisonEditor
                ref={legacy}
                initialValue={COMPARISON_SAMPLE}
                label={t("editor_comparison.current")}
                fileHandler={fileHandler}
                displayConfig={displayConfig}
              />
            </section>
            <section aria-labelledby="plate-title" className="min-w-0 rounded-lg border border-subtle bg-surface-1">
              <h2 id="plate-title" className="border-b border-subtle px-5 py-4 text-16 font-semibold">
                {t("editor_comparison.prototype")}
              </h2>
              <PlateComparisonEditor
                key={collaboration ? comparisonRoomName(collaboration) + collaboration.user.id : "local"}
                collaboration={collaboration}
                ref={plate}
                initialValue={COMPARISON_SAMPLE}
                displayConfig={displayConfig}
                labels={{
                  ...Object.fromEntries(additionalLabels.map((key) => [key, t(`editor_comparison.${key}`)])),
                  editor: t("editor_comparison.prototype"),
                  toolbar: t("editor_comparison.toolbar"),
                  bold: t("editor_comparison.bold"),
                  italic: t("editor_comparison.italic"),
                  underline: t("editor_comparison.underline"),
                  strikethrough: t("editor_comparison.strikethrough"),
                  code: t("editor_comparison.code"),
                  paragraph: t("editor_comparison.paragraph"),
                  heading1: t("editor_comparison.heading1"),
                  heading2: t("editor_comparison.heading2"),
                  blockquote: t("editor_comparison.blockquote"),
                  undo: t("editor_comparison.undo"),
                  redo: t("editor_comparison.redo"),
                }}
              />
            </section>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-2 rounded-lg border border-subtle p-5">
              <h2 className="text-16 font-semibold">{t("editor_comparison.scope")}</h2>
              <p className="text-14 text-secondary">{t("editor_comparison.scope_note")}</p>
            </section>
            <section className="space-y-2 rounded-lg border border-subtle p-5">
              <h2 className="text-16 font-semibold">{t("editor_comparison.collaboration")}</h2>
              <p className="text-14 text-secondary">{t("editor_comparison.collaboration_note")}</p>
            </section>
          </div>
          <section className="space-y-3">
            <label htmlFor="comparison-html" className="block text-16 font-semibold">
              {t("editor_comparison.source")}
            </label>
            <TextArea
              id="comparison-html"
              size="lg"
              surface="field"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              rows={8}
              autoResize={false}
            />
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              label={t("editor_comparison.import")}
              disabled={busy}
              onClick={() => void run(() => load(source))}
            />
          </section>
          <section className="space-y-3">
            <label htmlFor="comparison-markdown" className="block text-16 font-semibold">
              {t("editor_comparison.markdownSource")}
            </label>
            <TextArea
              id="comparison-markdown"
              size="lg"
              surface="field"
              rows={5}
              autoResize={false}
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
            />
            <Button
              size="sm"
              stretch="auto"
              variant="secondary"
              label={t("editor_comparison.markdown")}
              disabled={busy}
              onClick={() => void run(() => plate.current?.setMarkdown(markdown))}
            />
          </section>
          {outputs && (
            <section className="space-y-3" aria-label={t("editor_comparison.outputs")}>
              <h2 className="text-16 font-semibold">{t("editor_comparison.outputs")}</h2>
              <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                {(["tiptap", "plate"] as const).map((engine) => (
                  <div key={engine} className="min-w-0">
                    <h3 className="mb-2 font-medium">{engine === "tiptap" ? "Tiptap" : "Plate"}</h3>
                    <pre
                      data-testid={`${engine}-output`}
                      className="max-h-80 overflow-auto rounded-lg border border-subtle bg-layer-1 p-4 text-12 break-all whitespace-pre-wrap"
                    >
                      {outputs[engine]}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </SandboxAssetsProvider>
  );
}

export default observer(EditorComparisonPage);
