/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";

// Define the schema with more robust validation
export const convertDocumentSchema = z.object({
  description_html: z
    .string()
    .min(1, "HTML content cannot be empty")
    .refine((html) => html.trim().length > 0, "HTML content cannot be just whitespace")
    .refine((html) => html.includes("<") && html.includes(">"), "Content must be valid HTML"),
  variant: z.enum(["rich", "document"]),
});

export const formatValidationErrors = (error: z.ZodError) =>
  error.issues.map((err) => ({
    path: err.path.join("."),
    message: err.message,
  }));
