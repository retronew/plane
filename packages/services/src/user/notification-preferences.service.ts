import { API_BASE_URL } from "@plane/constants";
import type {
  TFeishuBindingStatus,
  TNotificationPreferences,
  TNotificationPreferencesPatch,
  TNotificationScope,
} from "@plane/types";
import { APIService } from "../api.service";

const PREFERENCES_URL = "/api/users/me/notification-preferences/v2/";
const FEISHU_URL = "/api/users/me/integrations/feishu/";

export class NotificationPreferencesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async retrieve(scope: TNotificationScope = {}): Promise<TNotificationPreferences> {
    return (await this.get(PREFERENCES_URL, { params: scope })).data;
  }

  async update(data: TNotificationPreferencesPatch, scope: TNotificationScope = {}): Promise<TNotificationPreferences> {
    return (await this.patch(PREFERENCES_URL, data, { params: scope })).data;
  }

  async feishuStatus(): Promise<TFeishuBindingStatus> {
    return (await this.get(FEISHU_URL)).data;
  }

  async authorizeFeishu(): Promise<{ authorization_url: string }> {
    return (await this.post(`${FEISHU_URL}authorize/`, {})).data;
  }

  async unlinkFeishu(): Promise<void> {
    await this.delete(FEISHU_URL);
  }

  async testFeishu(): Promise<{ delivery_id: string; status: string }> {
    return (await this.post(`${FEISHU_URL}test/`, {})).data;
  }
}
