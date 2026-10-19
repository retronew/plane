/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect, useRef } from "react";
import { Yace } from "yace";
import { code } from "yace/highlighters/code";
import { useTranslation } from "@plane/i18n";
import { ApiTokenCopyButton } from "./copy-feedback";

type Props = { value: string; label: string };

export function McpCodePreview({ value, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useLayoutEffect(() => {
    if (!container.current) return;
    const editor = new Yace(container.current, {
      value,
      lineNumbers: false,
      highlighters: [code()],
      styles: { fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: "12px", lineHeight: "1.75" },
    });
    editor.textarea.readOnly = true;
    editor.textarea.spellcheck = false;
    editor.textarea.setAttribute("aria-label", label);
    return () => editor.destroy();
  }, [value, label]);

  return (
    <div className="relative rounded-lg border border-strong bg-surface-1 text-primary">
      <div className="relative z-0 max-h-80 overflow-auto overscroll-contain rounded-[inherit]">
        <div
          ref={container}
          className="p-3 pr-12 [&_.yace-tok--com]:text-tertiary [&_.yace-tok--kw]:text-accent-primary [&_.yace-tok--num]:text-warning-primary [&_.yace-tok--str]:text-success-primary"
        />
      </div>
      <div className="absolute top-2.5 right-1.5 z-10">
        <ApiTokenCopyButton iconOnly value={value} label={t("account_settings.mcp.copy_config")} />
      </div>
    </div>
  );
}
