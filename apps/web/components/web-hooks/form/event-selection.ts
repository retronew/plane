export const WEBHOOK_EVENT_GROUPS = ["project", "cycle", "issue", "module", "issue_comment"] as const;
export const WEBHOOK_ACTIONS = ["created", "updated", "deleted"] as const;

export function getWebhookGroupEvents(group: string): string[] {
  return [
    ...WEBHOOK_ACTIONS.map((action) => `${group}.${action}`),
    ...(group === "issue" ? ["issue.state_changed", "issue.assigned"] : []),
  ];
}

export function normalizeWebhookEvents(
  data?: { events?: string[] } & Partial<Record<(typeof WEBHOOK_EVENT_GROUPS)[number], boolean>>
): string[] {
  if (!data) return [];
  const selected = data?.events?.length ? data.events : WEBHOOK_EVENT_GROUPS.filter((group) => data[group]);
  return [
    ...new Set(
      selected.flatMap((event) =>
        WEBHOOK_EVENT_GROUPS.some((group) => group === event) ? getWebhookGroupEvents(event) : [event]
      )
    ),
  ];
}

export function toggleWebhookEvents(selected: string[], targets: string[], checked: boolean): string[] {
  return checked ? [...new Set([...selected, ...targets])] : selected.filter((event) => !targets.includes(event));
}
