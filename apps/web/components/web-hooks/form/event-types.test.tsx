import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TWebhookEventTypes } from "@plane/types";
import { WebhookOptions } from "./event-types";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function TwoWebhookForms() {
  const [first, setFirst] = useState<TWebhookEventTypes>("all");
  const [second, setSecond] = useState<TWebhookEventTypes>("all");
  return (
    <>
      <WebhookOptions value={first} onChange={setFirst} />
      <WebhookOptions value={second} onChange={setSecond} />
    </>
  );
}

describe("webhook event radio groups", () => {
  it("keeps labels and native radio selection scoped to each mounted form", () => {
    render(<TwoWebhookForms />);
    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    expect(new Set(radios.map((radio) => radio.id)).size).toBe(4);
    expect(radios[0].name).toBe(radios[1].name);
    expect(radios[2].name).toBe(radios[3].name);
    expect(radios[0].name).not.toBe(radios[2].name);
    fireEvent.click(screen.getAllByText("workspace_settings.settings.webhooks.options.individual")[1]);
    expect(radios.map((radio) => radio.checked)).toEqual([true, false, false, true]);
  });
});
