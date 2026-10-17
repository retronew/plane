export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Phase = "pre" | "post";
export const METHODS = [
  "getWorkItem",
  "addComment",
  "addLabels",
  "removeLabels",
  "updateWorkItem",
  "createWorkItem",
  "http",
] as const;
export type Method = (typeof METHODS)[number];
export const DEFAULT_LIMITS = Object.freeze({
  wall_time_ms: 5000,
  cpu_time_ms: 1000,
  memory_bytes: 32 * 1024 * 1024,
  stack_bytes: 256 * 1024,
  max_rpc_calls: 20,
  max_rpc_bytes: 64 * 1024,
  max_log_bytes: 16 * 1024,
  max_logs: 100,
  max_result_bytes: 128 * 1024,
});
export type Limits = { -readonly [K in keyof typeof DEFAULT_LIMITS]: number };
export interface RunnerError {
  code: string;
  message: string;
}
export interface Log {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
}
export interface ExecutionInput {
  execution_id: string;
  source: string;
  context: Json;
  phase: Phase;
  limits: Limits;
}
export interface ExecuteRequest extends ExecutionInput {
  broker: { url: string; token: string };
}
export interface ExecutionResponse {
  success: boolean;
  result: Json;
  logs: Log[];
  error: RunnerError | null;
  metrics: { duration_ms: number; rpc_calls: number; log_bytes: number };
}
export const MAX_REQUEST_BYTES = 1024 * 1024;
export const BROKER_PATH = "/api/internal/workflow-runner/rpc/";
export class ExecutionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isMethod(value: unknown): value is Method {
  return typeof value === "string" && (METHODS as readonly string[]).includes(value);
}
function invalid(): never {
  throw new ExecutionError("INVALID_REQUEST", "Invalid execution request.");
}
export function parseRequest(value: unknown, brokerOrigin: string): ExecuteRequest {
  if (!isRecord(value)) return invalid();
  if (typeof value.execution_id !== "string" || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value.execution_id)) return invalid();
  if (typeof value.source !== "string" || Buffer.byteLength(value.source) > 256 * 1024) return invalid();
  if (value.phase !== "pre" && value.phase !== "post") return invalid();
  if (!("context" in value) || Buffer.byteLength(JSON.stringify(value.context)) > 256 * 1024) return invalid();
  if (!isRecord(value.broker) || typeof value.broker.url !== "string" || typeof value.broker.token !== "string")
    return invalid();
  if (!value.broker.token || value.broker.token.length > 8192 || /[\r\n]/.test(value.broker.token)) return invalid();
  let url: URL;
  try {
    url = new URL(value.broker.url);
  } catch {
    return invalid();
  }
  if (
    url.origin !== brokerOrigin ||
    url.pathname !== BROKER_PATH ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    return invalid();
  const limits: Limits = { ...DEFAULT_LIMITS };
  if (value.limits !== undefined) {
    if (!isRecord(value.limits)) return invalid();
    for (const [key, limit] of Object.entries(value.limits)) {
      if (
        !Object.hasOwn(DEFAULT_LIMITS, key) ||
        typeof limit !== "number" ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > DEFAULT_LIMITS[key as keyof Limits]
      )
        return invalid();
      limits[key as keyof Limits] = limit;
    }
  }
  return {
    execution_id: value.execution_id,
    source: value.source,
    context: value.context as Json,
    phase: value.phase,
    limits,
    broker: { url: url.href, token: value.broker.token },
  };
}
export function errorResponse(code: string, message: string): ExecutionResponse {
  return {
    success: false,
    result: null,
    logs: [],
    error: { code, message },
    metrics: { duration_ms: 0, rpc_calls: 0, log_bytes: 0 },
  };
}
export function redact(text: string, secrets: string[]): string {
  for (const secret of secrets) if (secret) text = text.split(secret).join("[REDACTED]");
  return text;
}
