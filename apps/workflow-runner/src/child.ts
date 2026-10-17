import { runSandbox } from "./sandbox.js";
import { ExecutionError, isRecord, type ExecutionInput, type Json } from "./protocol.js";

const pending = new Map<number, { resolve(value: Json): void; reject(error: Error): void }>();
let sequence = 0;
let started = false;
function send(message: unknown) {
  if (process.connected) process.send?.(message);
}
process.on("message", (message: unknown) => {
  if (!isRecord(message)) return;
  if (message.type === "rpc_result" && typeof message.id === "number") {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.ok) request.resolve(message.result as Json);
    else request.reject(new Error("SDK request failed."));
    return;
  }
  if (message.type !== "execute" || started) return;
  started = true;
  const input = message.input as ExecutionInput;
  let logBytes = 0;
  let logCount = 0;
  let rpcCount = 0;
  void runSandbox(input, {
    log(log) {
      logBytes += Buffer.byteLength(log.message);
      logCount++;
      if (logBytes > input.limits.max_log_bytes || logCount > input.limits.max_logs)
        throw new Error("Console limit exceeded.");
      send({ type: "log", log });
    },
    rpc(method, params) {
      rpcCount++;
      if (rpcCount > input.limits.max_rpc_calls) return Promise.reject(new Error("SDK call limit exceeded."));
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ type: "rpc", id, method, params });
      });
    },
  }).then(
    (result) => send({ type: "result", result }),
    (error: unknown) => {
      send({
        type: "error",
        error:
          error instanceof ExecutionError
            ? { code: error.code, message: error.message }
            : { code: "INTERNAL_ERROR", message: "Sandbox failed." },
      });
    }
  );
});
process.on("disconnect", () => process.exit(0));
process.on("uncaughtException", () => {
  send({ type: "error", error: { code: "CHILD_EXIT", message: "Sandbox process failed." } });
  process.exit(1);
});
