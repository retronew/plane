/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useLayoutEffect, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Field, FieldLabel } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { useTranslation } from "@plane/i18n";
import type { TProjectOverviewLink } from "@plane/types";

import { isResourceUrl, normalizeResourceUrl } from "./resource-url";

export function ResourceLinkDialog({
  open,
  link,
  pending,
  disabled,
  onClose,
  onOpenChangeComplete,
  onSave,
}: {
  open: boolean;
  link: TProjectOverviewLink | null;
  pending: boolean;
  disabled: boolean;
  onClose: () => void;
  onOpenChangeComplete: (open: boolean) => void;
  onSave: (data: { title: string; url: string }) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [title, setTitle] = useState(link?.title ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [invalidUrl, setInvalidUrl] = useState(false);
  const locked = pending || disabled;
  // Base UI needs a closed commit before opening a conditionally mounted dialog to animate entry.
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    // Synchronize Base UI's enter transition before paint; this is not form-state initialization.
    // eslint-disable-next-line react/set-state-in-effect, react-doctor/no-initialize-state
    setMounted(true);
  }, []);

  return (
    <Dialog
      open={mounted && open}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={(nextOpen) => !nextOpen && !pending && onClose()}
    >
      <DialogContent size="md">
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            if (locked) return;
            const normalizedUrl = normalizeResourceUrl(url);
            if (!isResourceUrl(normalizedUrl)) {
              setInvalidUrl(true);
              return;
            }
            setInvalidUrl(false);
            if (await onSave({ title: title.trim(), url: normalizedUrl })) onClose();
          }}
        >
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>
                  {t(link ? "web.project_overview.edit_link" : "web.project_overview.add_link")}
                </DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody tabIndex={0}>
              <div className="space-y-4">
                <Field name="url" invalid={invalidUrl}>
                  <FieldLabel htmlFor={`${id}-url`} size="lg" inset={false} required>
                    {t("web.project_overview.link_url")}
                  </FieldLabel>
                  <InputGroup size="lg">
                    <Input
                      id={`${id}-url`}
                      size="lg"
                      type="text"
                      inputMode="url"
                      maxLength={2048}
                      placeholder={t("link.modal.url.placeholder")}
                      value={url}
                      disabled={locked}
                      aria-required="true"
                      aria-invalid={invalidUrl}
                      aria-describedby={invalidUrl ? `${id}-error` : undefined}
                      onChange={(event) => {
                        setUrl(event.target.value);
                        setInvalidUrl(false);
                      }}
                    />
                  </InputGroup>
                  {invalidUrl && (
                    <p id={`${id}-error`} role="alert" className="text-caption-sm-regular text-danger-primary">
                      {t("web.project_overview.invalid_url")}
                    </p>
                  )}
                </Field>
                <Field name="title">
                  <FieldLabel htmlFor={`${id}-title`} size="lg" inset={false}>
                    {t("web.project_overview.link_title")}
                  </FieldLabel>
                  <InputGroup size="lg">
                    <Input
                      id={`${id}-title`}
                      size="lg"
                      value={title}
                      maxLength={255}
                      disabled={locked}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </InputGroup>
                </Field>
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button
              stretch="auto"
              variant="secondary"
              size="md"
              label={t("cancel")}
              disabled={pending}
              onClick={onClose}
            />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              type="submit"
              label={t("save")}
              disabled={locked}
              loading={pending}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
