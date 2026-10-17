import { getQuickJS, type QuickJSDeferredPromise, type QuickJSHandle } from "quickjs-emscripten";
import { performance } from "node:perf_hooks";
import { setTimeout as yieldToHost } from "node:timers/promises";
import { ExecutionError, isMethod, type ExecutionInput, type Json, type Log, type Method } from "./protocol.js";

export interface SandboxHost {
  log(log: Log): void;
  rpc(method: Method, params: Json[]): Promise<Json>;
}

// The bridge receives strings only: guest objects/proxies/getters never enter Node.
// All JSON operations happen inside the WASM heap and interrupt budget.
export async function runSandbox(input: ExecutionInput, host: SandboxHost): Promise<Json> {
  const quickjs = await getQuickJS();
  const runtime = quickjs.newRuntime();
  runtime.setMemoryLimit(input.limits.memory_bytes);
  runtime.setMaxStackSize(input.limits.stack_bytes);
  let cpuUsed = 0;
  let sliceStart = 0;
  let interrupted = false;
  let fatal: ExecutionError | undefined;
  let rpcCalls = 0;
  const active = new Set<QuickJSDeferredPromise>();
  runtime.setInterruptHandler(() => {
    interrupted = cpuUsed + performance.now() - sliceStart >= input.limits.cpu_time_ms;
    return interrupted || !!fatal;
  });
  const vm = runtime.newContext();
  const execute = <T>(fn: () => T): T => {
    sliceStart = performance.now();
    try {
      return fn();
    } finally {
      cpuUsed += performance.now() - sliceStart;
    }
  };
  const fail = (code: string, message: string) => {
    fatal = new ExecutionError(code, message);
    return vm.newError(message);
  };
  const stringArg = (handle: QuickJSHandle | undefined): string => {
    if (!handle || vm.typeof(handle) !== "string") throw new ExecutionError("RPC_ERROR", "Invalid bridge payload.");
    return vm.getString(handle);
  };
  const rpc = vm.newFunction("rpc", (methodHandle, paramsHandle) => {
    const method = stringArg(methodHandle);
    const paramsJson = stringArg(paramsHandle);
    if (++rpcCalls > input.limits.max_rpc_calls) return { error: fail("RPC_LIMIT", "SDK call limit exceeded.") };
    if (!isMethod(method) || (input.phase === "pre" && method !== "getWorkItem"))
      return { error: fail("RPC_ERROR", "SDK method is not permitted in this phase.") };
    if (Buffer.byteLength(paramsJson) > input.limits.max_rpc_bytes)
      return { error: fail("RPC_LIMIT", "SDK request is too large.") };
    const params: unknown = JSON.parse(paramsJson);
    if (!Array.isArray(params)) return { error: fail("RPC_ERROR", "Invalid SDK parameters.") };
    const promise = vm.newPromise();
    active.add(promise);
    void host
      .rpc(method, params as Json[])
      .then(
        (result) => {
          if (!promise.alive) return;
          const value = vm.newString(JSON.stringify(result));
          promise.resolve(value);
          value.dispose();
          return undefined;
        },
        () => {
          if (!promise.alive) return;
          // Never forward transport errors (which may contain capabilities/URLs).
          const error = vm.newError("SDK request failed.");
          promise.reject(error);
          error.dispose();
        }
      )
      .finally(() => {
        if (promise.alive) promise.dispose();
        active.delete(promise);
      });
    return promise.handle;
  });
  const log = vm.newFunction("log", (levelHandle, messageHandle) => {
    const level = stringArg(levelHandle);
    const message = stringArg(messageHandle);
    try {
      host.log({ level: level as Log["level"], message });
    } catch {
      return { error: fail("LOG_LIMIT", "Console output limit exceeded.") };
    }
    return vm.undefined;
  });
  vm.setProp(vm.global, "__runner_rpc", rpc);
  vm.setProp(vm.global, "__runner_log", log);
  rpc.dispose();
  log.dispose();
  let task: QuickJSHandle | undefined;
  try {
    // User source is a string to AsyncFunction, never interpolated as executable
    // wrapper code. The source has no lexical access to these native bridges.
    const bootstrap = `(() => {
      "use strict";
      const rpc = globalThis.__runner_rpc, log = globalThis.__runner_log;
      delete globalThis.__runner_rpc; delete globalThis.__runner_log;
      const stringify = JSON.stringify, parse = JSON.parse, StringValue = String;
      const frozen = Object.freeze, create = Object.create;
      const then = Function.prototype.call.bind(Promise.prototype.then);
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const context = parse(${JSON.stringify(JSON.stringify(input.context))});
      const sdk = Object.create(null);
      for (const method of ${JSON.stringify(["getWorkItem", "addComment", "addLabels", "removeLabels", "updateWorkItem", "createWorkItem", "http"])}) {
        sdk[method] = frozen((...args) => then(rpc(method, stringify(args)), parse));
      }
      frozen(sdk);
      const console = Object.create(null);
      for (const level of ["log", "info", "warn", "error", "debug"]) {
        console[level] = frozen((...args) => log(level, args.map(value => typeof value === "string" ? value : stringify(value)).join(" ")));
      }
      frozen(console);
      Object.defineProperty(globalThis, "console", {value: console, writable: false, configurable: false});
      const invoke = new AsyncFunction("context", "sdk", "console", ${JSON.stringify('"use strict";\n' + input.source)});
      const envelope = (ok, value, code, message) => {
        const data = create(null);
        data.ok = ok; data.value = value; data.code = code; data.message = message;
        return stringify(data);
      };
      return then(invoke(context, sdk, console), value => {
        let result;
        try { result = stringify(value); } catch { return envelope(false, null, "INVALID_RESULT", "Script result must be JSON serializable."); }
        if (result === undefined) return envelope(false, null, "INVALID_RESULT", "Script must return a JSON value.");
        return envelope(true, parse(result));
      }, error => {
        let message = "Script threw an exception.";
        try { message = StringValue(error && error.message !== undefined ? error.message : error).slice(0, 2048); } catch {}
        return envelope(false, null, "SCRIPT_ERROR", message);
      });
    })()`;
    const evaluated = execute(() => vm.evalCode(bootstrap, "workflow.js"));
    if (evaluated.error) {
      evaluated.error.dispose();
      throw (
        fatal ??
        new ExecutionError(
          interrupted ? "TIMEOUT" : "SCRIPT_ERROR",
          interrupted ? "Script CPU time limit exceeded." : "Script could not be evaluated (syntax or memory limit)."
        )
      );
    }
    task = evaluated.value;
    for (;;) {
      if (fatal) throw fatal;
      const jobs = execute(() => runtime.executePendingJobs(64));
      if (jobs.error) {
        jobs.error.dispose();
        throw (
          fatal ??
          new ExecutionError(
            interrupted ? "TIMEOUT" : "MEMORY_LIMIT",
            interrupted ? "Script CPU time limit exceeded." : "Script exceeded runtime limits."
          )
        );
      }
      if (fatal) throw fatal;
      const state = execute(() => vm.getPromiseState(task!));
      if (state.type === "fulfilled") {
        const serialized = vm.getString(state.value);
        state.value.dispose();
        if (Buffer.byteLength(serialized) > input.limits.max_result_bytes)
          throw new ExecutionError("INVALID_RESULT", "Script result is too large.");
        const envelope = JSON.parse(serialized) as { ok: boolean; value: Json; code: string; message: string };
        if (interrupted) throw new ExecutionError("TIMEOUT", "Script CPU time limit exceeded.");
        if (!envelope.ok) {
          const oom = /out of memory|allocation failed/i.test(envelope.message);
          throw new ExecutionError(
            oom ? "MEMORY_LIMIT" : envelope.code,
            oom ? "Script memory limit exceeded." : envelope.message
          );
        }
        const value = envelope.value;
        if (
          input.phase === "pre" &&
          (typeof value !== "object" ||
            value === null ||
            Array.isArray(value) ||
            typeof value.success !== "boolean" ||
            (value.reason !== undefined && typeof value.reason !== "string"))
        )
          throw new ExecutionError("INVALID_RESULT", "Pre script must return {success:boolean,reason?:string}.");
        return value;
      }
      if (state.type === "rejected") {
        state.error.dispose();
        throw (
          fatal ??
          new ExecutionError(
            interrupted ? "TIMEOUT" : "MEMORY_LIMIT",
            interrupted ? "Script CPU time limit exceeded." : "Script exceeded runtime limits."
          )
        );
      }
      // Yield while the broker is pending; a never-settling promise must not spin Node.
      // oxlint-disable-next-line no-await-in-loop
      await yieldToHost(1);
    }
  } finally {
    for (const promise of active) promise.dispose();
    task?.dispose();
    vm.dispose();
    runtime.dispose();
  }
}
