export type TFeishuConfiguration = {
  enabled: boolean;
  app_id: string;
  secret_configured: boolean;
  verification_token_configured: boolean;
  encrypt_key_configured: boolean;
  callback_url: string;
  card_callback_url: string;
  managed_by_env: boolean;
  current_user_bound: boolean;
  last_delivery: TFeishuDelivery | null;
};

export type TFeishuDelivery = {
  status: "pending" | "retry" | "sent" | "failed" | "cancelled";
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

export type TFeishuFormValues = {
  FEISHU_ENABLED: boolean;
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  FEISHU_VERIFICATION_TOKEN: string;
  FEISHU_ENCRYPT_KEY: string;
};

export type TFeishuConfigurationPayload = {
  FEISHU_ENABLED: "0" | "1";
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET?: string;
  FEISHU_VERIFICATION_TOKEN?: string;
  FEISHU_ENCRYPT_KEY?: string;
};
