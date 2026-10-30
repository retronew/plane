import { forwardRef } from "react";
import { RichTextEditorWithRef } from "@plane/editor";
import type { EditorRefApi, TDisplayConfig, TFileHandler } from "@plane/editor";

export const LegacyComparisonEditor = forwardRef<
  EditorRefApi,
  { initialValue: string; label: string; fileHandler: TFileHandler; displayConfig?: TDisplayConfig }
>(function LegacyComparisonEditor({ initialValue, label, fileHandler, displayConfig }, ref) {
  return (
    <fieldset aria-label={label}>
      <RichTextEditorWithRef
        ref={ref}
        id="comparison-tiptap"
        initialValue={initialValue}
        editable
        disabledExtensions={[]}
        flaggedExtensions={[]}
        fileHandler={fileHandler}
        displayConfig={displayConfig}
        getEditorMetaData={() => ({ file_assets: [], user_mentions: [] })}
        mentionHandler={{
          renderComponent: ({ entity_identifier }) => <span>@{entity_identifier === "demo-lin" ? "林" : "Alex"}</span>,
          getMentionedEntityDetails: (id) => ({ display_name: id === "demo-lin" ? "林" : "Alex" }),
          searchCallback: async (query) => [
            {
              key: "user_mention",
              items: [
                { id: "demo-alex", title: "Alex" },
                { id: "demo-lin", title: "林" },
              ]
                .filter((member) => member.title.toLowerCase().includes(query.toLowerCase()))
                .map((member) => ({
                  id: member.id,
                  title: member.title,
                  entity_identifier: member.id,
                  entity_name: "user_mention" as const,
                  icon: null,
                })),
            },
          ],
        }}
        extendedEditorProps={{}}
        containerClassName="min-h-80 p-6"
        dragDropEnabled
      />
    </fieldset>
  );
});
