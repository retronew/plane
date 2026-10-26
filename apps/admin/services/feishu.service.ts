import { InstanceService } from "@plane/services";
import type {
  TFeishuConfiguration,
  TFeishuConfigurationPayload,
  TFeishuDirectoryPreview,
  TFeishuDirectoryMode,
  TFeishuDirectorySelection,
  TFeishuDirectoryUser,
} from "@/types/feishu";

// Keep Feishu-specific endpoints local to admin; the inherited HTTP client includes credentials.
export class FeishuService extends InstanceService {
  async createDirectoryPreview(mode: TFeishuDirectoryMode = "unbound"): Promise<TFeishuDirectoryPreview> {
    return (await this.post("/api/instances/feishu/directory/", { mode })).data;
  }

  async directoryPreview(previewId: string): Promise<TFeishuDirectoryPreview> {
    return (await this.get("/api/instances/feishu/directory/", { params: { preview_id: previewId } })).data;
  }

  async directoryUsers(search: string): Promise<TFeishuDirectoryUser[]> {
    return (await this.get("/api/instances/feishu/directory/users/", { params: { search } })).data;
  }

  async bindDirectory(
    previewId: string,
    selections: TFeishuDirectorySelection[],
    enableNotifications: boolean
  ): Promise<TFeishuDirectoryPreview> {
    return (
      await this.post("/api/instances/feishu/directory/bind/", {
        preview_id: previewId,
        selections,
        enable_notifications: enableNotifications,
      })
    ).data;
  }

  async unbindDirectory(previewId: string, rowId: string): Promise<void> {
    await this.post("/api/instances/feishu/directory/unbind/", { preview_id: previewId, row_id: rowId });
  }

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
