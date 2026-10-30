import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { usePageFilters } from "@/hooks/use-page-filters";
import { useTranslation } from "@plane/i18n";

/** Apply only the changed span so concurrent edits retain their Yjs identity. */
export function updateCollaborativeTitle(text: Y.Text, value: string) {
  const previous = text.toString();
  let start = 0;
  while (start < previous.length && start < value.length && previous[start] === value[start]) start++;
  let end = 0;
  while (
    end < previous.length - start &&
    end < value.length - start &&
    previous[previous.length - end - 1] === value[value.length - end - 1]
  )
    end++;
  text.doc?.transact(() => {
    text.delete(start, previous.length - start - end);
    text.insert(start, value.slice(start, value.length - end));
  });
}

export function CollaborativePageTitle({
  provider,
  editable,
  initialValue,
  onTitleChange,
}: {
  provider: HocuspocusProvider | null;
  editable: boolean;
  initialValue: string;
  onTitleChange: (title: string) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialValue);
  const [ready, setReady] = useState(false);
  const { fontSize } = usePageFilters();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "0px";
      input.style.height = `${input.scrollHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(input);
    return () => observer.disconnect();
  });
  useEffect(() => {
    if (!provider) return;
    const text = provider.document.getText("title");
    const update = () => {
      if (!provider.isSynced) return;
      setReady(true);
      setTitle(text.toString());
      onTitleChange(text.toString());
    };
    text.observe(update);
    provider.on("synced", update);
    update();
    return () => {
      text.unobserve(update);
      provider.off("synced", update);
    };
  }, [provider, onTitleChange]);
  return (
    <textarea
      ref={inputRef}
      aria-label={t("web.title")}
      placeholder="Untitled"
      value={title}
      rows={1}
      className={`no-scrollbar my-6 block w-full resize-none overflow-hidden rounded-none border-none bg-transparent p-0 font-bold tracking-[-2%] outline-none placeholder:text-placeholder ${fontSize === "large-font" ? "text-[2rem] leading-[2.375rem]" : "text-[1.6rem] leading-[1.9rem]"}`}
      maxLength={255}
      readOnly={!editable || !provider || !ready}
      onChange={(event) => {
        if (!provider || !editable || !ready) return;
        setTitle(event.target.value);
        updateCollaborativeTitle(provider.document.getText("title"), event.target.value);
        onTitleChange(event.target.value);
      }}
    />
  );
}
