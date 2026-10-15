import type { ReactNode } from "react";
import { Select } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import { AsyncContent } from "@/components/common/async-content";
import { ChartLoader } from "../loaders";
import AnalyticsRequestError from "../request-error";

export function PreviewChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Select
      getValues={() => options}
      value={options.find((option) => option.id === value) ?? null}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.label}
      onChange={(id) => {
        const option = options.find((item) => item.id === id);
        if (option) onChange(option.id);
      }}
      showSearch={false}
      pinSelected={false}
    >
      <Select.Trigger variant="select-md" label={label} className="w-auto">
        {options.find((option) => option.id === value)?.label}
      </Select.Trigger>
    </Select>
  );
}
export function PreviewContent({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
  children: ReactNode;
}) {
  return error ? (
    <AnalyticsRequestError onRetry={retry} />
  ) : (
    <AsyncContent
      loading={loading}
      skeleton={
        <div className="space-y-8">
          <ChartLoader />
          <ChartLoader />
        </div>
      }
      minHeight={480}
    >
      {children}
    </AsyncContent>
  );
}
export function PreviewNote() {
  const { t } = useTranslation();
  return <p className="-mt-3 mb-6 text-13 text-tertiary">{t("workspace_analytics.preview.note")}</p>;
}
