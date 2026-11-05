import { useRef, useState } from "react";
import useSWR from "swr";
import { DailyDigestService } from "@plane/services";
import type { TDailyDigestSettings, TDailyDigestSettingsPatch } from "@plane/types";

const service = new DailyDigestService();

/** Keep the form stable during saves and serialize rapid changes instead of dropping them. */
export function useDigestSettings() {
  const { data, error, mutate } = useSWR("DAILY_DIGEST_SETTINGS", () => service.retrieve());
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const processing = useRef(false);
  const queue = useRef<TDailyDigestSettingsPatch[]>([]);

  async function update(patch: TDailyDigestSettingsPatch) {
    queue.current.push(patch);
    // SWR updates synchronously so the next interaction uses the newest selected values.
    void mutate((current) => (current ? { ...current, ...patch } : current), { revalidate: false });
    if (processing.current) return;
    processing.current = true;
    setSaving(true);
    setSaveState("idle");
    let confirmed: TDailyDigestSettings | undefined = data;
    try {
      while (queue.current.length) {
        const next = queue.current.shift()!;
        // oxlint-disable-next-line no-await-in-loop -- Ordered patches must not race or overwrite newer choices.
        confirmed = await service.update(next);
      }
      // Do not replace optimistic state between requests: older responses must not flash back.
      void mutate(confirmed, { revalidate: false });
      setSaveState("saved");
    } catch {
      queue.current = [];
      void mutate(confirmed, { revalidate: false });
      setSaveState("error");
    } finally {
      processing.current = false;
      setSaving(false);
    }
  }
  return { data, error, mutate, update, saving, saveState };
}
