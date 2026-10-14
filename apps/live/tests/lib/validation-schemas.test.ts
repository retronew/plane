/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { convertDocumentSchema, formatValidationErrors } from "@/controllers/document.schema";
import { envSchema } from "@/env-schema";

const requiredEnv = { API_BASE_URL: "http://localhost:8000", LIVE_SERVER_SECRET_KEY: "secret" };

const errorPaths = (result: ReturnType<typeof convertDocumentSchema.safeParse>) =>
  result.success ? [] : formatValidationErrors(result.error).map((issue) => issue.path);

describe("envSchema", () => {
  it("fills defaults and converts the numeric settings", () => {
    const result = envSchema.safeParse(requiredEnv);

    expect(result.success && result.data).toEqual({
      ...requiredEnv,
      APP_VERSION: "1.0.0",
      PORT: "3000",
      CORS_ALLOWED_ORIGINS: "",
      LIVE_BASE_PATH: "/live",
      COMPRESSION_LEVEL: 6,
      COMPRESSION_THRESHOLD: 5000,
      REDIS_PORT: 6379,
    });
  });

  it("keeps provided values and drops unknown keys", () => {
    const result = envSchema.safeParse({ ...requiredEnv, PORT: "4000", COMPRESSION_LEVEL: "9", EXTRA: "x" });

    expect(result.success && result.data).toMatchObject({ PORT: "4000", COMPRESSION_LEVEL: 9 });
    expect(result.success && "EXTRA" in result.data).toBe(false);
  });

  it("rejects an invalid API_BASE_URL with the custom message", () => {
    const result = envSchema.safeParse({ ...requiredEnv, API_BASE_URL: "not a url" });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["API_BASE_URL"], message: "API_BASE_URL must be a valid URL" }),
    ]);
  });

  it("requires the API URL and the server secret", () => {
    const result = envSchema.safeParse({});

    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "API_BASE_URL",
      "LIVE_SERVER_SECRET_KEY",
    ]);
  });
});

describe("convertDocumentSchema", () => {
  it("accepts HTML for either variant", () => {
    expect(convertDocumentSchema.safeParse({ description_html: "<p>hi</p>", variant: "rich" }).success).toBe(true);
    expect(convertDocumentSchema.safeParse({ description_html: "<p>hi</p>", variant: "document" }).success).toBe(true);
  });

  it.each([
    ["", ["HTML content cannot be empty", "HTML content cannot be just whitespace", "Content must be valid HTML"]],
    ["   ", ["HTML content cannot be just whitespace", "Content must be valid HTML"]],
    ["plain text", ["Content must be valid HTML"]],
  ])("rejects %j with the custom messages", (description_html, messages) => {
    const result = convertDocumentSchema.safeParse({ description_html, variant: "rich" });

    expect(result.success).toBe(false);
    expect(result.success ? [] : formatValidationErrors(result.error)).toEqual(
      messages.map((message) => ({ path: "description_html", message }))
    );
  });

  it("reports an unknown variant, missing fields and wrong types by path", () => {
    expect(errorPaths(convertDocumentSchema.safeParse({ description_html: "<p>x</p>", variant: "page" }))).toEqual([
      "variant",
    ]);
    expect(errorPaths(convertDocumentSchema.safeParse({}))).toEqual(["description_html", "variant"]);
    expect(errorPaths(convertDocumentSchema.safeParse({ description_html: 5, variant: "rich" }))).toEqual([
      "description_html",
    ]);
  });
});
