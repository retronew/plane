/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { StateGroupIcon } from "@plane/blocks/icons";
import { EIconSize } from "@plane/constants";
import { StateIconFrame } from "../state-icon-frame";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Button } from "@makeplane/propel/components/button";
import { ColorSwatchPicker } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import type { IState, TStateGroups } from "@plane/types";

type TStateForm = {
  data: Partial<IState>;
  stateGroup?: TStateGroups;
  percentage?: number;
  onSubmit: (formData: Partial<IState>) => Promise<{ status: string }>;
  onCancel: () => void;
  buttonDisabled: boolean;
  buttonTitle: string;
};

export function StateForm({
  data,
  stateGroup = data.group ?? "backlog",
  percentage,
  onSubmit,
  onCancel,
  buttonDisabled,
  buttonTitle,
}: TStateForm) {
  const { t } = useTranslation();
  const nameId = useId();
  const [formData, setFormData] = useState<Partial<IState>>(data);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const disabled = buttonDisabled || submitting;
  const color = formData.color || "#60646C";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (buttonDisabled || inFlight.current) return;
    const name = formData.name?.trim();
    if (!name) {
      setError(t("web.name_is_required"));
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const result = await onSubmit({ ...formData, name });
      if (result.status !== "success") setError(t("web.configuration_save_error"));
    } catch {
      setError(t("web.configuration_save_error"));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented && !disabled) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };
  return (
    <form className="flex min-h-14 flex-col justify-center rounded-md bg-layer-2 px-2 py-2.5" onSubmit={submit}>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                disabled={disabled}
                aria-label={t("aria_labels.color_picker.open")}
                className="flex size-7 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                <StateIconFrame color={color}>
                  <StateGroupIcon stateGroup={stateGroup} color={color} size={EIconSize.XL} percentage={percentage} />
                </StateIconFrame>
              </button>
            }
          />
          <PopoverContent variant="rich" side="bottom" align="start">
            <ColorSwatchPicker
              className="w-88"
              value={color}
              onChange={(hex) => setFormData((previous) => ({ ...previous, color: hex }))}
            />
          </PopoverContent>
        </Popover>
        <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
          <Field name="name" invalid={Boolean(error)}>
            <InputGroup size="lg">
              <Input
                size="lg"
                id={nameId}
                name="name"
                aria-label={t("web.name")}
                onKeyDown={cancelOnEscape}
                aria-describedby={error ? `${nameId}-error` : undefined}
                placeholder={t("web.name")}
                value={formData.name ?? ""}
                maxLength={100}
                disabled={disabled}
                onChange={(event) => {
                  setFormData({ ...formData, name: event.target.value });
                  setError("");
                }}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus the inline editor when opened
                autoFocus
              />
            </InputGroup>
          </Field>
        </div>
        <div className="order-3 w-full min-w-0 sm:order-none sm:flex-1">
          <Field name="description">
            <InputGroup size="lg">
              <Input
                size="lg"
                name="description"
                aria-label={t("description")}
                onKeyDown={cancelOnEscape}
                placeholder={t("web.describe_this_state_for_your_members")}
                value={formData.description ?? ""}
                maxLength={1000}
                disabled={disabled}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              />
            </InputGroup>
          </Field>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 self-center">
          <Button
            type="button"
            variant="ghost"
            size="md"
            stretch="auto"
            label={t("web.cancel")}
            disabled={disabled}
            onClick={onCancel}
            onKeyDown={cancelOnEscape}
          />
          <Button
            onKeyDown={cancelOnEscape}
            type="submit"
            variant="primary"
            size="md"
            stretch="auto"
            label={buttonTitle}
            disabled={disabled}
          />
        </div>
      </div>
      {error && (
        <p id={`${nameId}-error`} role="alert" className="mt-2 pl-10 text-12 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
