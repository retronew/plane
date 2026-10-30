/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Tag } from "lucide-react";
import { STATE_GROUP_COLORS, StateGroupIcon } from "@plane/blocks/icons";
import { EIconSize } from "@plane/constants";
import { StateIconFrame } from "../state-icon-frame";
import { STATE_ICON_PRESETS, stateIconLabel } from "../icon-presets";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Button } from "@makeplane/propel/components/button";
import { ColorSwatchPicker } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import type { IState, TStateGroups } from "@plane/types";

type TStateForm = {
  data: Partial<IState>;
  kind?: "state" | "label";
  stateGroup?: TStateGroups;
  percentage?: number;
  onSubmit: (formData: Partial<IState>) => Promise<{ status: string }>;
  onCancel: () => void;
  buttonDisabled: boolean;
  buttonTitle: string;
  focusNameOnOpen?: boolean;
  colorPickerInitiallyOpen?: boolean;
  allowIconSelection?: boolean;
};

export function StateForm({
  data,
  kind = "state",
  stateGroup = data.group ?? "backlog",
  percentage,
  onSubmit,
  onCancel,
  buttonDisabled,
  buttonTitle,
  focusNameOnOpen = false,
  colorPickerInitiallyOpen = false,
  allowIconSelection = true,
}: TStateForm) {
  const { t } = useTranslation();
  const nameId = useId();
  const [formData, setFormData] = useState<Partial<IState>>(data);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const disabled = buttonDisabled || submitting;
  const defaultColor = kind === "state" ? STATE_GROUP_COLORS[stateGroup] : "#60646C";
  const color = formData.color || defaultColor;
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
      if (result.status !== "success")
        setError(
          t(
            kind === "label" && result.status === "already_exists"
              ? "label.create.already_exists"
              : "web.configuration_save_error"
          )
        );
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
        <Popover defaultOpen={colorPickerInitiallyOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                disabled={disabled}
                aria-label={t("aria_labels.color_picker.open")}
                className="flex size-7 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                <StateIconFrame color={color}>
                  {kind === "label" ? (
                    <Tag className="size-4" style={{ color }} />
                  ) : (
                    <StateGroupIcon
                      stateGroup={stateGroup}
                      icon={formData.icon}
                      color={color}
                      size={EIconSize.XL}
                      percentage={percentage}
                    />
                  )}
                </StateIconFrame>
              </button>
            }
          />
          <PopoverContent variant="rich" side="bottom" align="start" data-category-color-picker="" initialFocus={false}>
            {kind === "state" && allowIconSelection && (
              <fieldset className="mb-3 w-72">
                <legend className="mb-2 text-12 font-medium text-secondary">{t("web.state_icon")}</legend>
                <div className="grid grid-cols-5 gap-2">
                  {STATE_ICON_PRESETS.map((icon) => (
                    <button
                      key={icon ?? "auto"}
                      type="button"
                      title={t(stateIconLabel(icon))}
                      aria-label={t(stateIconLabel(icon))}
                      aria-pressed={(formData.icon ?? null) === icon}
                      className="flex h-9 items-center justify-center rounded-md border border-transparent hover:bg-layer-1-hover focus-visible:outline-2 focus-visible:outline-accent-strong aria-pressed:border-accent-strong aria-pressed:bg-layer-1-hover"
                      onClick={() => setFormData((previous) => ({ ...previous, icon }))}
                    >
                      {icon === null ? (
                        <span className="text-11">{t("web.state_icon_auto")}</span>
                      ) : (
                        <StateIconFrame color={color}>
                          <StateGroupIcon stateGroup={stateGroup} icon={icon} color={color} size={EIconSize.XL} />
                        </StateIconFrame>
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <ColorSwatchPicker
              continuous
              className="w-72 gap-1 [&_fieldset]:gap-1.5"
              value={color}
              onClear={() => setFormData((previous) => ({ ...previous, color: defaultColor }))}
              onChange={(hex) => setFormData((previous) => ({ ...previous, color: hex }))}
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                stretch="auto"
                label={t("web.state_color_reset")}
                onClick={() => setFormData((previous) => ({ ...previous, color: defaultColor }))}
              />
            </div>
          </PopoverContent>
        </Popover>
        <div className={kind === "label" ? "min-w-0 flex-1" : "min-w-0 flex-1 sm:w-36 sm:flex-none"}>
          <Field name="name" invalid={Boolean(error)}>
            <InputGroup size="lg">
              <Input
                size="lg"
                id={nameId}
                name="name"
                aria-label={t("web.name")}
                onKeyDown={cancelOnEscape}
                aria-describedby={error ? `${nameId}-error` : undefined}
                placeholder={t(kind === "label" ? "project_settings.labels.label_title" : "web.name")}
                value={formData.name ?? ""}
                maxLength={kind === "label" ? 255 : 100}
                disabled={disabled}
                onChange={(event) => {
                  setFormData({ ...formData, name: event.target.value });
                  setError("");
                }}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- only new state creation opts into focus
                autoFocus={focusNameOnOpen}
              />
            </InputGroup>
          </Field>
        </div>
        {kind === "state" && (
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
        )}
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
