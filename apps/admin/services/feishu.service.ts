import { InstanceService } from "@plane/services";
import type { TFeishuConfiguration, TFeishuConfigurationPayload } from "@/types/feishu";

// Keep Feishu-specific endpoints local to admin; the inherited HTTP client includes credentials.
export class FeishuService extends InstanceService {
  async configuration(): Promise<TFeishuConfiguration> {
    const response = await this.get("/api/instances/feishu/");
    return response.data;
  }

  async saveConfiguration(payload: TFeishuConfigurationPayload): Promise<void> {
    await this.patch("/api/instances/configurations/", payload);
  }

  async checkConfiguration(): Promise<{ success: true }> {
    const response = await this.post("/api/instances/feishu/check/");
    return response.data;
  }

  async sendTest(): Promise<{ success: true; status: "queued" }> {
    const response = await this.post("/api/instances/feishu/test/");
    return response.data;
  }
}
