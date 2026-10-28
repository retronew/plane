import { useState } from "react";
import { useParams } from "next/navigation";
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
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { DateRangeSelect } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import { renderFormattedPayloadDate } from "@plane/utils";
import { UserService } from "@/services/user.service";

const userService = new UserService();
type Preview = {
  count: number;
  timezone: string;
  start_date: string;
  end_date: string;
  results: { identifier: string; name: string; state: string; changed_at: string }[];
};

export function DownloadActivityButton() {
  const { workspaceSlug, userId } = useParams();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("yesterday");
  const [range, setRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [feedback, setFeedback] = useState("");
  const key = "profile.stats.recent_activity" as const;
  const run = async (selected: string, download: boolean) => {
    if (!workspaceSlug || !userId || busy) return;
    setBusy(true);
    setFeedback("");
    const data = {
      period: selected,
      ...(selected === "custom"
        ? { start_date: renderFormattedPayloadDate(range.from), end_date: renderFormattedPayloadDate(range.to) }
        : {}),
    };
    try {
      const result: Preview = await userService.downloadProfileActivity(String(workspaceSlug), String(userId), {
        ...data,
        preview: true,
      });
      setPreview(result);
      if (!download || result.count === 0) {
        if (!result.count) setFeedback(t(`${key}.export_empty`));
        return;
      }
      const csv: string = await userService.downloadProfileActivity(String(workspaceSlug), String(userId), data);
      const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `profile-activity-${result.start_date}-${result.end_date}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setFeedback(t(`${key}.export_error`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={busy ? t(`${key}.button_loading`) : t(`${key}.button`)}
          disabled={busy}
          loading={busy}
          onClick={() => void run("today", true)}
        />
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={t(`${key}.more_dates`)}
          disabled={busy}
          onClick={() => {
            setPreview(null);
            setFeedback("");
            setOpen(true);
          }}
        />
      </div>
      {!open && preview && (
        <p className="text-12 text-secondary">{t(`${key}.timezone_note`, { timezone: preview.timezone })}</p>
      )}
      {!open && feedback && <output className="text-12 text-secondary">{feedback}</output>}
      <ActivityExportDialog
        {...{
          open,
          busy,
          period,
          range,
          preview,
          feedback,
          setOpen,
          setPeriod,
          setRange,
          setPreview,
          setFeedback,
          run,
        }}
      />
    </div>
  );
}

const key = "profile.stats.recent_activity" as const;
type Range = { from: Date | null; to: Date | null };
function ActivityExportDialog({
  open,
  busy,
  period,
  range,
  preview,
  feedback,
  setOpen,
  setPeriod,
  setRange,
  setPreview,
  setFeedback,
  run,
}: {
  open: boolean;
  busy: boolean;
  period: string;
  range: Range;
  preview: Preview | null;
  feedback: string;
  setOpen: (value: boolean) => void;
  setPeriod: (value: string) => void;
  setRange: (value: Range) => void;
  setPreview: (value: Preview | null) => void;
  setFeedback: (value: string) => void;
  run: (period: string, download: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const options = ["yesterday", "week", "custom"].map((value) => ({
    value,
    label: t(`${key}.${value}` as `${typeof key}.yesterday`),
  }));
  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (busy) details.cancel();
        else setOpen(next);
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t(`${key}.more_dates`)}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <p className="text-13 text-secondary">{t(`${key}.export_description`)}</p>
              <Select
                value={period}
                items={options}
                disabled={busy}
                onValueChange={(value) => {
                  if (value) {
                    setPeriod(value);
                    setPreview(null);
                    setFeedback("");
                  }
                }}
              >
                <SelectTrigger size="md" aria-label={t(`${key}.period`)} />
                <SelectContent>
                  <SelectList>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value} label={option.label} />
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
              {period === "custom" && (
                <DateRangeSelect
                  variant="pill-sm"
                  value={range}
                  onChange={(value) => {
                    setRange(value);
                    setPreview(null);
                    setFeedback("");
                  }}
                  placeholder={t(`${key}.custom`)}
                />
              )}
              <p className="text-12 text-secondary">
                {preview ? t(`${key}.timezone_note`, { timezone: preview.timezone }) : t(`${key}.timezone_pending`)}
              </p>
              {preview && (
                <output className="block text-13">
                  {t(`${key}.export_count`, { count: preview.count })} · {preview.start_date} – {preview.end_date}
                </output>
              )}
              {feedback && <output className="block text-13 text-secondary">{feedback}</output>}
              {preview && preview.count > 0 && (
                <ul className="max-h-60 space-y-2 overflow-y-auto">
                  {preview.results.map((row) => (
                    <li key={row.identifier} className="text-13">
                      <span className="text-secondary">{row.identifier}</span> {row.name} · {row.state}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            label={t("cancel")}
            disabled={busy}
            onClick={() => setOpen(false)}
          />
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            label={t(`${key}.preview`)}
            disabled={busy || (period === "custom" && (!range.from || !range.to))}
            onClick={() => void run(period, false)}
          />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={t("export")}
            loading={busy}
            disabled={busy || (period === "custom" && (!range.from || !range.to))}
            onClick={() => void run(period, true)}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
