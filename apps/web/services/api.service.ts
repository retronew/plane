/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { CanceledError, create } from "axios";
import { issueSync } from "@/lib/sync/issue-sync";
import { normalizeAPIRequestURL } from "@plane/services";
import { withIssueSyncMutation } from "./issue-sync-mutation";

export abstract class APIService {
  protected baseURL: string;
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.axiosInstance = create({
      baseURL,
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.axiosInstance.interceptors.request.use((config) => {
      try {
        if (config.url) {
          config.url = normalizeAPIRequestURL(config.url, this.baseURL);
        }
      } catch (error) {
        // Never block a request because of slash normalization — fall back to the
        // original URL and let the call proceed.
        console.warn("[APIService] Failed to normalize trailing slash:", config.url, error);
      }
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          const currentPath = window.location.pathname;
          // Public auth pages request the current user while signed out, so
          // their expected 401s must not interrupt registration or email binding.
          const publicAuthPaths = new Set([
            "/",
            "/sign-up",
            "/accounts/forgot-password",
            "/accounts/reset-password",
            "/accounts/oidc/bind-email",
          ]);
          const normalizedPath = currentPath.replace(/\/+$/, "") || "/";
          if (!publicAuthPaths.has(normalizedPath)) {
            const returnPath = `${currentPath}${window.location.search || ""}${window.location.hash || ""}`;
            window.location.replace(`/?next_path=${encodeURIComponent(returnPath)}`);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  get(url: string, params = {}, config: AxiosRequestConfig = {}) {
    const revision = issueSync.revision;
    return this.axiosInstance
      .get(url, {
        ...params,
        ...config,
      })
      .then((response) => {
        if (/\/(?:issues|issues-detail|archived-issues)\//.test(url) && revision !== issueSync.revision) {
          issueSync.invalidate();
          throw new CanceledError("Issue response invalidated by a local mutation");
        }
        return response;
      });
  }

  private mutate<T>(url: string | undefined, request: () => Promise<T>): Promise<T> {
    const issueMutation =
      /\/(?:issues|archived-issues|draft-issues|draft-to-issue|issue-dates|bulk-[^/]*issues|cycles|modules)\//.test(
        url ?? ""
      );
    return issueMutation ? withIssueSyncMutation(request) : request();
  }

  post(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.mutate(url, () => this.axiosInstance.post(url, data, config));
  }

  put(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.mutate(url, () => this.axiosInstance.put(url, data, config));
  }

  patch(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.mutate(url, () => this.axiosInstance.patch(url, data, config));
  }

  delete(url: string, data?: any, config: AxiosRequestConfig = {}) {
    return this.mutate(url, () => this.axiosInstance.delete(url, { data, ...config }));
  }

  request(config: AxiosRequestConfig = {}) {
    if (["post", "put", "patch", "delete"].includes(config.method?.toLowerCase() ?? "get")) {
      return this.mutate(config.url, () => this.axiosInstance(config));
    }
    return this.axiosInstance(config);
  }
}
