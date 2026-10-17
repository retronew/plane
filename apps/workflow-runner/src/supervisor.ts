import { fork, type ChildProcess } from "node:child_process";
import { performance } from "node:perf_hooks";
import {
  ExecutionError,
  errorResponse,
  isMethod,
  isRecord,
  redact,
  type ExecuteRequest,
  type ExecutionResponse,
  type Json,
  type Log,
} from "./protocol.js";

export interface SupervisorOptions {
  // Injection is used only by process-crash regression tests, never HTTP input.
  childPath?: URL;
  serviceToken?: string;
  signal?: AbortSignal;
}

async function brokerCall(
  input: ExecuteRequest,
  id: number,
  method: string,
  params: Json[],
  signal: AbortSignal,
  serviceToken?: string
): Promise<Json> {
  const response = await fetch(input.broker.url, {
    method: "POST",
    redirect: "error",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.broker.token}`,
      "X-Workflow-Execution-Id": input.execution_id,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!response.ok || !response.body) throw new ExecutionError("RPC_ERROR", "Broker rejected SDK request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > input.limits.max_rpc_bytes) throw new ExecutionError("RPC_LIMIT", "SDK response is too large.");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  const result: unknown = JSON.parse(text);
  if (!isRecord(result) || result.jsonrpc !== "2.0" || result.id !== id || !("result" in result) || "error" in result)
    throw new ExecutionError("RPC_ERROR", "Broker returned an SDK error.");
  // Defense in depth if a broker accidentally reflects Authorization or secrets.
  return JSON.parse(redact(JSON.stringify(result.result), [input.broker.token, serviceToken ?? ""])) as Json;
}

function kill(child: ChildProcess) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export function execute(input: ExecuteRequest, options: SupervisorOptions = {}): Promise<ExecutionResponse> {
  const start = performance.now();
  const response = errorResponse("INTERNAL_ERROR", "Execution failed.");
  const abort = new AbortController();
  const secrets = [input.broker.token, options.serviceToken ?? ""];
  let child: ChildProcess;
  try {
    child = fork(options.childPath ?? new URL("./child.js", import.meta.url), [], {
      // Deliberately do not inherit API secrets, NODE_OPTIONS, preload hooks or env.
      env: {},
      execArgv: ["--max-old-space-size=128", "--disable-proto=throw"],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      detached: true,
      serialization: "json",
    });
  } catch {
    return Promise.resolve(errorResponse("CHILD_EXIT", "Sandbox process could not start."));
  }
  return new Promise((resolve) => {
    let settled = false;
    let outstanding = 0;
    let rpcQueue: Promise<unknown> = Promise.resolve();
    const seen = new Set<number>();
    const finish = (error?: ExecutionError, result: Json = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancelled);
      abort.abort();
      kill(child);
      response.success = !error;
      response.result = result;
      response.error = error ? { code: error.code, message: redact(error.message, secrets) } : null;
      response.metrics.duration_ms = Math.round(performance.now() - start);
      // Resolve only after exit, so wall timeouts leave no running sandbox.
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) resolve(response);
      else child.once("exit", () => resolve(response));
    };
    const timer = setTimeout(
      () => finish(new ExecutionError("TIMEOUT", "Script wall time limit exceeded.")),
      input.limits.wall_time_ms
    );
    const cancelled = () => finish(new ExecutionError("CHILD_EXIT", "Execution was cancelled."));
    options.signal?.addEventListener("abort", cancelled, { once: true });
    child.on("error", () => finish(new ExecutionError("CHILD_EXIT", "Sandbox process failed.")));
    child.on("exit", () => {
      if (!settled) finish(new ExecutionError("CHILD_EXIT", "Sandbox process exited unexpectedly."));
    });
    child.on("message", (message: unknown) => {
      if (settled) return;
      if (!isRecord(message)) return finish(new ExecutionError("RPC_ERROR", "Invalid sandbox message."));
      if (message.type === "log") {
        if (
          !isRecord(message.log) ||
          typeof message.log.message !== "string" ||
          !["log", "info", "warn", "error", "debug"].includes(String(message.log.level))
        )
          return finish(new ExecutionError("LOG_LIMIT", "Invalid console output."));
        const log = { level: message.log.level, message: redact(message.log.message, secrets) } as Log;
        response.metrics.log_bytes += Buffer.byteLength(log.message);
        if (response.logs.length >= input.limits.max_logs || response.metrics.log_bytes > input.limits.max_log_bytes)
          return finish(new ExecutionError("LOG_LIMIT", "Console output limit exceeded."));
        response.logs.push(log);
        return;
      }
      if (message.type === "rpc") {
        const { id, method, params } = message;
        if (
          !Number.isSafeInteger(id) ||
          typeof id !== "number" ||
          id !== seen.size + 1 ||
          seen.has(id) ||
          !isMethod(method) ||
          !Array.isArray(params) ||
          (input.phase === "pre" && method !== "getWorkItem")
        )
          return finish(new ExecutionError("RPC_ERROR", "Invalid SDK request."));
        seen.add(id);
        response.metrics.rpc_calls++;
        if (
          response.metrics.rpc_calls > input.limits.max_rpc_calls ||
          Buffer.byteLength(JSON.stringify(params)) > input.limits.max_rpc_bytes
        )
          return finish(new ExecutionError("RPC_LIMIT", "SDK request limit exceeded."));
        outstanding++;
        rpcQueue = rpcQueue
          .then(() => {
            if (settled) throw new ExecutionError("RPC_ERROR", "Execution ended.");
            return brokerCall(input, id, method, params as Json[], abort.signal, options.serviceToken);
          })
          .then(
            (result) => {
              outstanding--;
              if (!settled && child.connected) child.send({ type: "rpc_result", id, ok: true, result });
              return undefined;
            },
            (error: unknown) => {
              outstanding--;
              // A failed/oversized broker call is fail-closed even if JS catches it.
              finish(error instanceof ExecutionError ? error : new ExecutionError("RPC_ERROR", "SDK request failed."));
            }
          );
        return;
      }
      if (message.type === "result") {
        if (outstanding)
          return finish(
            new ExecutionError("RPC_ERROR", "Script returned with pending SDK calls; await every SDK action.")
          );
        if (!("result" in message) || Buffer.byteLength(JSON.stringify(message.result)) > input.limits.max_result_bytes)
          return finish(new ExecutionError("INVALID_RESULT", "Invalid script result."));
        return finish(undefined, JSON.parse(redact(JSON.stringify(message.result), secrets)) as Json);
      }
      if (
        message.type === "error" &&
        isRecord(message.error) &&
        typeof message.error.code === "string" &&
        typeof message.error.message === "string"
      )
        return finish(new ExecutionError(message.error.code, message.error.message.slice(0, 2048)));
      finish(new ExecutionError("RPC_ERROR", "Invalid sandbox message."));
    });
    // Never send the broker endpoint, capability or service token to the child.
    child.send({
      type: "execute",
      input: {
        execution_id: input.execution_id,
        source: input.source,
        context: input.context,
        phase: input.phase,
        limits: input.limits,
      },
    });
    if (options.signal?.aborted) cancelled();
  });
}
