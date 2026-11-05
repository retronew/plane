import { API_BASE_URL } from "@plane/constants";
import type { TDailyDigestPreview, TDailyDigestSettings, TDailyDigestSettingsPatch } from "@plane/types";
import { APIService } from "../api.service";

const DIGEST_URL = "/api/users/me/daily-digest/";

export class DailyDigestService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async retrieve(): Promise<TDailyDigestSettings> {
    return (await this.get(DIGEST_URL)).data;
  }

  async update(data: TDailyDigestSettingsPatch): Promise<TDailyDigestSettings> {
    return (await this.patch(DIGEST_URL, data)).data;
  }

  async preview(): Promise<TDailyDigestPreview> {
    return (await this.post(`${DIGEST_URL}preview/`, {})).data;
  }
}
