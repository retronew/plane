import { createServer, type IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { execute } from "./supervisor.js";
import { ExecutionError, MAX_REQUEST_BYTES, errorResponse, parseRequest } from "./protocol.js";

export interface ServerConfig {
  serviceToken: string;
  brokerOrigin: string;
  maxConcurrent: number;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const serviceToken = env.WORKFLOW_RUNNER_SERVICE_TOKEN ?? "";
  if (serviceToken.length < 32 || /[\r\n]/.test(serviceToken))
    throw new Error("WORKFLOW_RUNNER_SERVICE_TOKEN must contain at least 32 characters.");
  const url = new URL(env.WORKFLOW_RUNNER_BROKER_ORIGIN ?? "http://api:8000");
  if (!["http:", "https:"].includes(url.protocol) || url.href !== `${url.origin}/` || url.username || url.password)
    throw new Error("WORKFLOW_RUNNER_BROKER_ORIGIN must be an HTTP(S) origin.");
  const maxConcurrent = Number(env.WORKFLOW_RUNNER_MAX_CONCURRENT ?? 2);
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 8)
    throw new Error("WORKFLOW_RUNNER_MAX_CONCURRENT must be 1..8.");
  return { serviceToken, brokerOrigin: url.origin, maxConcurrent };
}
async function readBody(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new ExecutionError("INVALID_REQUEST", "Execution request is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ExecutionError("INVALID_REQUEST", "Expected a JSON execution request.");
  }
}
export function createRunnerServer(config: ServerConfig) {
  let running = 0;
  const active = new Set<AbortController>();
  const server = createServer(async (req, res) => {
    const reply = (status: number, body: unknown) => {
      if (res.destroyed) return;
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/healthz") return reply(200, { status: "ok" });
    if (req.method !== "POST" || req.url !== "/execute")
      return reply(404, errorResponse("INVALID_REQUEST", "Route not found."));
    const actual = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${config.serviceToken}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return reply(401, errorResponse("UNAUTHORIZED", "Invalid service authorization."));
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return reply(400, errorResponse("INVALID_REQUEST", "Expected application/json."));
    if (running >= config.maxConcurrent) return reply(429, errorResponse("BUSY", "Runner capacity reached."));
    running++;
    const abort = new AbortController();
    active.add(abort);
    const cancelled = () => {
      if (!res.writableEnded) abort.abort();
    };
    res.on("close", cancelled);
    // Bound slow request bodies separately from the sandbox wall clock.
    req.setTimeout(5000, () => {
      abort.abort();
      req.destroy();
    });
    try {
      const input = parseRequest(await readBody(req), config.brokerOrigin);
      if (abort.signal.aborted) return;
      const result = await execute(input, { serviceToken: config.serviceToken, signal: abort.signal });
      reply(200, result);
    } catch (error: unknown) {
      reply(
        error instanceof ExecutionError ? 400 : 500,
        errorResponse(
          error instanceof ExecutionError ? error.code : "INTERNAL_ERROR",
          error instanceof ExecutionError ? error.message : "Execution failed."
        )
      );
    } finally {
      running--;
      active.delete(abort);
      res.removeListener("close", cancelled);
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  server.on("close", () => {
    for (const abort of active) abort.abort();
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createRunnerServer(loadConfig());
  server.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? "0.0.0.0", () =>
    process.stdout.write("Workflow runner listening.\n")
  );
  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
