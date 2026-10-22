import type { TFeishuConfigurationPayload, TFeishuFormValues } from "@/types/feishu";

export function buildFeishuPayload(values: TFeishuFormValues): TFeishuConfigurationPayload {
  return {
    FEISHU_ENABLED: values.FEISHU_ENABLED ? "1" : "0",
    FEISHU_APP_ID: values.FEISHU_APP_ID.trim(),
    // An empty secret preserves the saved credential. Never hydrate it from the API.
    ...(values.FEISHU_APP_SECRET.trim() ? { FEISHU_APP_SECRET: values.FEISHU_APP_SECRET } : {}),
    ...(values.FEISHU_VERIFICATION_TOKEN.trim() ? { FEISHU_VERIFICATION_TOKEN: values.FEISHU_VERIFICATION_TOKEN } : {}),
    ...(values.FEISHU_ENCRYPT_KEY.trim() ? { FEISHU_ENCRYPT_KEY: values.FEISHU_ENCRYPT_KEY } : {}),
  };
}

export function getFeishuErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) return undefined;
  const response = error.response;
  if (!response || typeof response !== "object" || !("data" in response)) return undefined;
  const data = response.data;
  return data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : undefined;
}
