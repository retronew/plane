export type * from "./custom-properties.types";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import type {
  TCustomProperty,
  TCustomPropertyInput,
  TCustomPropertyList,
  TCustomPropertyOption,
  TCustomPropertyOptionInput,
  TCustomPropertyValues,
  TIssueCustomPropertyValues,
} from "./custom-properties.types";

export class CustomPropertiesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  projectBase(slug: string, projectId: string) {
    return `/api/workspaces/${slug}/projects/${projectId}/`;
  }

  async list(slug: string, projectId: string, typeId?: string): Promise<TCustomPropertyList> {
    if (typeId) return this.typeProperties(slug, projectId, typeId);
    return (await this.get(`${this.projectBase(slug, projectId)}custom-properties/`)).data;
  }

  async save(
    slug: string,
    projectId: string,
    data: Partial<TCustomPropertyInput>,
    id?: string
  ): Promise<TCustomProperty> {
    return id ? this.update(slug, projectId, id, data) : this.create(slug, projectId, data as TCustomPropertyInput);
  }

  async saveOption(
    slug: string,
    projectId: string,
    propertyId: string,
    data: Partial<TCustomPropertyOptionInput>,
    id?: string
  ): Promise<TCustomPropertyOption> {
    return id
      ? this.updateOption(slug, projectId, propertyId, id, data)
      : this.createOption(slug, projectId, propertyId, data as TCustomPropertyOptionInput);
  }

  async create(slug: string, projectId: string, data: TCustomPropertyInput): Promise<TCustomProperty> {
    return (await this.post(`${this.projectBase(slug, projectId)}custom-properties/`, data)).data;
  }

  async update(
    slug: string,
    projectId: string,
    id: string,
    data: Partial<TCustomPropertyInput>
  ): Promise<TCustomProperty> {
    return (await this.patch(`${this.projectBase(slug, projectId)}custom-properties/${id}/`, data)).data;
  }

  async remove(slug: string, projectId: string, id: string): Promise<void> {
    await this.delete(`${this.projectBase(slug, projectId)}custom-properties/${id}/`);
  }

  async createOption(
    slug: string,
    projectId: string,
    id: string,
    data: TCustomPropertyOptionInput
  ): Promise<TCustomPropertyOption> {
    return (await this.post(`${this.projectBase(slug, projectId)}custom-properties/${id}/options/`, data)).data;
  }

  async updateOption(
    slug: string,
    projectId: string,
    id: string,
    optionId: string,
    data: Partial<TCustomPropertyOptionInput>
  ): Promise<TCustomPropertyOption> {
    return (await this.patch(`${this.projectBase(slug, projectId)}custom-properties/${id}/options/${optionId}/`, data))
      .data;
  }

  async removeOption(slug: string, projectId: string, id: string, optionId: string): Promise<void> {
    await this.delete(`${this.projectBase(slug, projectId)}custom-properties/${id}/options/${optionId}/`);
  }

  async bindType(
    slug: string,
    projectId: string,
    typeId: string,
    propertyId: string,
    data: { is_active: boolean; is_required: boolean }
  ): Promise<TCustomProperty> {
    return (
      await this.put(`${this.projectBase(slug, projectId)}issue-types/${typeId}/custom-properties/${propertyId}/`, data)
    ).data;
  }

  async typeProperties(slug: string, projectId: string, typeId: string): Promise<TCustomPropertyList> {
    return (await this.get(`${this.projectBase(slug, projectId)}issue-types/${typeId}/custom-properties/`)).data;
  }

  async values(slug: string, projectId: string, issueId: string): Promise<TIssueCustomPropertyValues> {
    return (await this.get(`${this.projectBase(slug, projectId)}issues/${issueId}/custom-properties/`)).data;
  }

  async updateValues(
    slug: string,
    projectId: string,
    issueId: string,
    values: TCustomPropertyValues
  ): Promise<TIssueCustomPropertyValues> {
    return (await this.put(`${this.projectBase(slug, projectId)}issues/${issueId}/custom-properties/`, { values }))
      .data;
  }
}
