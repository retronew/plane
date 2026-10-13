/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Request, Response } from "express";
import { z } from "zod";
// helpers
import { Controller, Post } from "@plane/decorators";
import { convertHTMLDocumentToAllFormats } from "@plane/editor";
// logger
import { logger } from "@plane/logger";
import type { TConvertDocumentRequestBody } from "@/types";
import { convertDocumentSchema, formatValidationErrors } from "./document.schema";

@Controller("/convert-document")
export class DocumentController {
  @Post("/")
  async convertDocument(req: Request, res: Response) {
    try {
      // Validate request body
      const validatedData = convertDocumentSchema.parse(req.body as TConvertDocumentRequestBody);
      const { description_html, variant } = validatedData;

      // Process document conversion
      const { description_json, description_binary } = convertHTMLDocumentToAllFormats({
        document_html: description_html,
        variant,
      });

      // Return successful response
      res.status(200).json({
        description_json,
        description_binary,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatValidationErrors(error);
        logger.error("DOCUMENT_CONTROLLER: Validation error", {
          validationErrors,
        });
        return res.status(400).json({
          message: `Validation error`,
          context: {
            validationErrors,
          },
        });
      } else {
        logger.error("DOCUMENT_CONTROLLER: Internal server error", error);
        return res.status(500).json({
          message: `Internal server error.`,
        });
      }
    }
  }
}
