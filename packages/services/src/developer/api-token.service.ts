/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { IApiToken } from "@plane/types";
import { APIService } from "../api.service";

export class APITokenService extends APIService {
  constructor(
    BASE_URL?: string,
    private workspaceSlug?: string
  ) {
    super(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves all API tokens for a specific workspace
   * @returns {Promise<IApiToken[]>} Array of API tokens associated with the workspace
   * @throws {Error} Throws response data if the request fails
   */
  private get endpoint() {
    return this.workspaceSlug
      ? `/api/workspaces/${encodeURIComponent(this.workspaceSlug)}/api-tokens/`
      : "/api/users/api-tokens/";
  }

  async list(): Promise<IApiToken[]> {
    return this.get(this.endpoint)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Retrieves a specific API token by its ID
   * @param {string} tokenId - The unique identifier of the API token
   * @returns {Promise<IApiToken>} The requested API token's details
   * @throws {Error} Throws response data if the request fails
   */
  async retrieve(tokenId: string): Promise<IApiToken> {
    return this.get(`${this.endpoint}${tokenId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Creates a new API token for a workspace
   * @param {Partial<IApiToken>} data - The data for creating the new API token
   * @returns {Promise<IApiToken>} The newly created API token
   * @throws {Error} Throws response data if the request fails
   */
  async create(data: Partial<IApiToken>): Promise<IApiToken> {
    return this.post(this.endpoint, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Deletes a specific API token from the workspace
   * @param {string} tokenId - The unique identifier of the API token to delete
   * @returns {Promise<IApiToken>} The deleted API token's details
   * @throws {Error} Throws response data if the request fails
   */
  async destroy(tokenId: string): Promise<IApiToken> {
    return this.delete(`${this.endpoint}${tokenId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
