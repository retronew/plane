/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { CopyFeedback, useCopyFeedback } from "./copy-feedback";

type Props = { value: string; block?: boolean };

// A value the user has to type or paste somewhere (repository URL, branch, command),
// shown as code with a compact copy button next to it.
export function InlineCopyCode({ value, block = false }: Props) {
  const { t } = useTranslation();
  const { copied, copy } = useCopyFeedback();
  return (
    <span
      className={cn(
        "max-w-full items-center gap-0.5 rounded-md border border-subtle bg-surface-2 py-0.5 pr-0.5 pl-1.5 align-middle",
        block ? "flex w-full" : "inline-flex"
      )}
    >
      <code className="font-mono min-w-0 flex-1 text-11 break-all text-primary">{value}</code>
      <button
        type="button"
        className="focus-visible:outline-primary grid size-5 shrink-0 place-items-center rounded text-tertiary transition-colors hover:bg-layer-1 hover:text-primary focus-visible:outline-2"
        aria-label={t("account_settings.skills.copy_value", { value })}
        onClick={() => void copy(value)}
      >
        <CopyFeedback copied={copied} iconClassName="size-3" />
      </button>
    </span>
  );
}
