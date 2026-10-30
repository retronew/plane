import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ComparisonAssetStore,
  registerComparisonAssets,
  validateComparisonImage,
  COMPARISON_ASSET_LIMIT,
} from "@/editor-comparison-assets";
const mocks = vi.hoisted(() => ({ user: vi.fn(), get: vi.fn() }));
vi.mock("@/env", () => ({ env: { CORS_ALLOWED_ORIGINS: "", LIVE_BASE_PATH: "/live" } }));
vi.mock("@/services/user.service", () => ({
  UserService: class {
    currentUser = mocks.user;
  },
}));
vi.mock("@/services/api.service", () => ({
  APIService: class {
    get = mocks.get;
  },
}));
const project = "11111111-1111-4111-8111-111111111111";
const room = `plate-comparison:v1:workspace:${project}:22222222-2222-4222-8222-222222222222`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64"
);
const headers = { Cookie: "session=test", Origin: "http://localhost:3000", "Content-Type": "image/png" };
let directory: string;
let server: Server;
let origin: string;
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user", display_name: "User" });
  mocks.get.mockResolvedValue({
    data: { member: { id: "user" }, project: { id: project }, role: 15, is_active: true },
  });
  directory = await mkdtemp(join(tmpdir(), "plane-assets-"));
  const app = express();
  const router = express.Router();
  registerComparisonAssets(router, new ComparisonAssetStore(directory));
  app.use("/live", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
const upload = () =>
  fetch(`${origin}/live/editor-comparison/assets?room=${encodeURIComponent(room)}&userId=user`, {
    method: "POST",
    headers,
    body: png,
  });

describe("comparison image HTTP endpoints", () => {
  it("uploads and serves a room image to another authenticated member without binding the URL to its author", async () => {
    const response = await upload();
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    const asset = (await response.json()) as { id: string; url: string };
    mocks.user.mockResolvedValue({ id: "other", display_name: "Other" });
    mocks.get.mockResolvedValue({
      data: { member: { id: "other" }, project: { id: project }, role: 15, is_active: true },
    });
    const image = await fetch(`${origin}${asset.url}`, { headers: { Cookie: "{{SECRET_xphztb3d}}" } });
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(image.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
    expect((await new ComparisonAssetStore(directory).load(room, asset.id)).data).toEqual(png);
    const otherRoom = room.replace("22222222-2222", "33333333-3333");
    const missing = await fetch(
      `${origin}/live/editor-comparison/assets/${asset.id}?room=${encodeURIComponent(otherRoom)}`,
      { headers }
    );
    expect(missing.status).toBe(404);
  });
  it("denies anonymous reads and nonmember uploads", async () => {
    const asset = (await (await upload()).json()) as { url: string };
    expect((await fetch(`${origin}${asset.url}`)).status).toBe(403);
    mocks.get.mockRejectedValue(new Error("forbidden"));
    expect((await upload()).status).toBe(403);
    expect((await fetch(`${origin}${asset.url}`, { headers })).status).toBe(403);
  });
  it("handles credentialed preflight", async () => {
    const response = await fetch(`${origin}/live/editor-comparison/assets`, {
      method: "OPTIONS",
      headers: {
        Origin: headers.Origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
  it("rejects oversized uploads", async () => {
    const response = await fetch(`${origin}/live/editor-comparison/assets?room=${encodeURIComponent(room)}`, {
      method: "POST",
      headers,
      body: Buffer.alloc(COMPARISON_ASSET_LIMIT + 1),
    });
    expect(response.status).toBe(413);
  });
  it("rejects SVG, spoofed image MIME and foreign-origin uploads", async () => {
    expect(() => validateComparisonImage(Buffer.from("<svg/>"), "image/svg+xml")).toThrow();
    expect(() => validateComparisonImage(png, "image/jpeg")).toThrow();
    const response = await fetch(`${origin}/live/editor-comparison/assets?room=${encodeURIComponent(room)}`, {
      method: "POST",
      headers,
      body: "<svg/>",
    });
    expect(response.status).toBe(400);
    const forbidden = await fetch(`${origin}/live/editor-comparison/assets?room=${encodeURIComponent(room)}`, {
      method: "POST",
      headers: { ...headers, Origin: "https://evil.example" },
      body: png,
    });
    expect(forbidden.status).toBe(403);
  });
});
