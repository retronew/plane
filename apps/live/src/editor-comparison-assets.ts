import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { NextFunction, Request, Response, Router } from "express";
import cors from "cors";
import {
  authorizeComparisonRoom,
  comparisonEnabled,
  comparisonOrigins,
  parseComparisonRoom,
} from "@/editor-comparison";
import { env } from "@/env";

export const COMPARISON_ASSET_LIMIT = 5 * 1024 * 1024;
const ASSET_PATH = "/editor-comparison/assets";
const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
]);
export function validateComparisonImage(data: Buffer, mime: string) {
  if (!data.length || data.length > COMPARISON_ASSET_LIMIT) throw new Error("Invalid image size");
  const valid =
    (mime === "image/png" &&
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      data.length >= 24) ||
    (mime === "image/jpeg" && data[0] === 255 && data[1] === 216 && data[2] === 255 && data.length >= 4) ||
    (mime === "image/gif" &&
      ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("ascii")) &&
      data.length >= 13) ||
    (mime === "image/webp" &&
      data.subarray(0, 4).toString("ascii") === "RIFF" &&
      data.subarray(8, 12).toString("ascii") === "WEBP" &&
      data.length >= 20);
  if (!valid) throw new Error("Unsupported image or MIME mismatch");
}

export class ComparisonAssetStore {
  constructor(private directory: string) {}
  private roomPath(room: string) {
    parseComparisonRoom(room);
    return join(this.directory, createHash("sha256").update(room).digest("hex"));
  }
  async save(room: string, data: Buffer, mime: string) {
    validateComparisonImage(data, mime);
    const directory = this.roomPath(room);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const id = `${randomUUID()}.${IMAGE_TYPES.get(mime)}`;
    const path = join(directory, id);
    const temporary = `${path}.tmp`;
    try {
      await writeFile(temporary, data, { mode: 0o600, flag: "wx" });
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch(() => {});
    }
    return id;
  }
  async load(room: string, id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/.test(id))
      throw new Error("Invalid asset ID");
    const extension = id.split(".").at(-1);
    const mime = [...IMAGE_TYPES].find(([, value]) => value === extension)![0];
    const data = await readFile(join(this.roomPath(room), id));
    validateComparisonImage(data, mime);
    return { data, mime };
  }
}

function asyncHandler(handler: (request: Request, response: Response, next: NextFunction) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    // oxlint-disable-next-line promise/no-callback-in-promise -- Express 4 requires forwarding rejected handlers to next.
    void handler(request, response, next).catch(next);
  };
}

const authorize = asyncHandler(async (request, response, next) => {
  try {
    const room = request.query.room;
    if (typeof room !== "string") throw new Error("Missing room");
    if (request.method === "POST" && (!request.headers.origin || !comparisonOrigins().includes(request.headers.origin)))
      throw new Error("Forbidden origin");
    if (request.query.userId !== undefined && typeof request.query.userId !== "string") throw new Error("Invalid user");
    await authorizeComparisonRoom(room, request.headers.cookie, request.query.userId as string | undefined);
    response.locals.comparisonRoom = room;
    next();
  } catch {
    response.status(403).json({ error: "Comparison room access denied" });
  }
});

export function registerComparisonAssets(
  router: Router,
  store = new ComparisonAssetStore(fileURLToPath(new URL("../.editor-comparison-data/assets/", import.meta.url)))
) {
  if (!comparisonEnabled()) return;
  // The application CORS middleware can decline an origin; this route supplies its own explicit dev allowlist.
  router.use(
    ASSET_PATH,
    cors({
      origin: comparisonOrigins(),
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  );
  router.post(
    ASSET_PATH,
    authorize,
    express.raw({ type: [...IMAGE_TYPES.keys()], limit: COMPARISON_ASSET_LIMIT }),
    asyncHandler(async (request, response) => {
      try {
        if (!Buffer.isBuffer(request.body)) throw new Error("Expected image bytes");
        const room = response.locals.comparisonRoom as string;
        const id = await store.save(room, request.body, request.headers["content-type"] ?? "");
        response
          .status(201)
          .json({ id, url: `${env.LIVE_BASE_PATH}${ASSET_PATH}/${id}?room=${encodeURIComponent(room)}` });
      } catch {
        response.status(400).json({ error: "Invalid image; use PNG, JPEG, GIF or WebP up to 5 MB" });
      }
    })
  );
  router.get(
    `${ASSET_PATH}/:assetId`,
    authorize,
    asyncHandler(async (request, response) => {
      try {
        const { data, mime } = await store.load(
          response.locals.comparisonRoom as string,
          request.params.assetId as string
        );
        response
          .set({
            "Content-Type": mime,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
            "Cross-Origin-Resource-Policy": "same-site",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          })
          .send(data);
      } catch {
        response.status(404).json({ error: "Image not found" });
      }
    })
  );
  router.use(ASSET_PATH, (error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
      response.status(413).json({ error: "Image exceeds 5 MB" });
    } else next(error);
  });
}
