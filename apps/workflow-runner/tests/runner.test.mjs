// Cases run sequentially so each sandbox has a deterministic resource budget.
/* oxlint-disable no-await-in-loop */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { execute } from "../dist/supervisor.js";
import { BROKER_PATH, DEFAULT_LIMITS, parseRequest } from "../dist/protocol.js";
import { createRunnerServer, loadConfig } from "../dist/server.js";

const token = "test-broker-capability-never-in-child";
const serviceToken = "test-service-token-at-least-32-characters";
let broker;
let origin;
let requests = [];
before(async () => {
  broker = createServer(async (req, res) => {
    assert.equal(req.url, BROKER_PATH);
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    let body = "";
    for await (const chunk of req) body += chunk;
    const rpc = JSON.parse(body);
    requests.push(rpc);
    res.setHeader("Content-Type", "application/json");
    if (rpc.params[0] === "redirect") {
      res.writeHead(302, { Location: "http://127.0.0.1:1/leak" });
      return res.end();
    }
    if (rpc.params[0] === "oversized") return res.end("x".repeat(70000));
    if (rpc.params[0] === "reflect-secret")
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { token, serviceToken } }));
    if (rpc.params[0] === "broker-error")
      return res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, error: { message: token } }));
    if (rpc.params[0] === "slow") await new Promise((resolve) => setTimeout(resolve, 100));
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: rpc.id,
        result: { id: rpc.params[0] ?? "current", name: "Example", method: rpc.method },
      })
    );
  });
  broker.listen(0, "127.0.0.1");
  await once(broker, "listening");
  origin = `http://127.0.0.1:${broker.address().port}`;
});
after(() => {
  broker.close();
  broker.closeAllConnections();
});
function input(source, overrides = {}) {
  return {
    execution_id: "test-execution",
    source,
    context: { proposed: { name: "Proposed" } },
    phase: "pre",
    limits: { ...DEFAULT_LIMITS },
    broker: { url: origin + BROKER_PATH, token },
    ...overrides,
  };
}
const run = (source, overrides) => execute(input(source, overrides), { serviceToken });

test("actual QuickJS async SDK, context, and console", async () => {
  const result = await run(
    'const item = await sdk.getWorkItem("item-1"); console.info(item.name, context.proposed); await Promise.resolve(); return {success: item.id === "item-1"};'
  );
  assert.equal(result.success, true, JSON.stringify(result));
  assert.deepEqual(result.result, { success: true });
  assert.deepEqual(result.logs, [{ level: "info", message: 'Example {"name":"Proposed"}' }]);
  assert.equal(result.metrics.rpc_calls, 1);
  assert.ok(result.metrics.duration_ms > 0);
  assert.deepEqual(requests.at(-1), { jsonrpc: "2.0", id: 1, method: "getWorkItem", params: ["item-1"] });
});
test("false result is valid and preserves reason", async () => {
  const result = await run('return {success:false,reason:"Blocked"};');
  assert.equal(result.success, true);
  assert.deepEqual(result.result, { success: false, reason: "Blocked" });
});
test("post accepts arbitrary JSON and all SDK methods return promises", async () => {
  const result = await run(
    'const names = ["addComment","addLabels","removeLabels","updateWorkItem","createWorkItem","http"]; const result = []; for (const name of names) {const promise = sdk[name]("x", {}); if (!(promise instanceof Promise)) throw new Error("not a promise"); result.push(await promise);} return result;',
    { phase: "post" }
  );
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.result.length, 6);
});
test("throw, syntax, invalid pre and undefined post fail closed", async () => {
  for (const [source, phase, code] of [
    ['throw new Error("Nope");', "pre", "SCRIPT_ERROR"],
    ["return ;;;; !@", "pre", "SCRIPT_ERROR"],
    ["return true;", "pre", "INVALID_RESULT"],
    ['return {success:"true"};', "pre", "INVALID_RESULT"],
    ["return {success:true,reason:4};", "pre", "INVALID_RESULT"],
    ["return undefined;", "post", "INVALID_RESULT"],
    ["return 1n;", "post", "INVALID_RESULT"],
  ]) {
    const result = await run(source, { phase });
    assert.equal(result.success, false, source);
    assert.equal(result.error.code, code, JSON.stringify(result));
  }
});
test("sync and async infinite loops interrupted; wall timeout kills unresolved promise", async () => {
  for (const source of ["while(true) {}", "while(true) await Promise.resolve();", "await new Promise(() => {});"]) {
    const result = await run(source, { limits: { ...DEFAULT_LIMITS, cpu_time_ms: 30, wall_time_ms: 400 } });
    assert.equal(result.error.code, "TIMEOUT", JSON.stringify(result));
    assert.ok(result.metrics.duration_ms < 2000);
  }
});
test("async waiting does not consume CPU time", async () => {
  const result = await run('await sdk.getWorkItem("slow"); return {success:true};', {
    limits: { ...DEFAULT_LIMITS, cpu_time_ms: 50 },
  });
  assert.equal(result.success, true, JSON.stringify(result));
});
test("heap and stack limits are enforced", async () => {
  const memory = await run("const data = new ArrayBuffer(16 * 1024 * 1024); return {success:!!data};", {
    limits: { ...DEFAULT_LIMITS, memory_bytes: 2 * 1024 * 1024 },
  });
  assert.equal(memory.success, false);
  assert.ok(["MEMORY_LIMIT", "CHILD_EXIT"].includes(memory.error.code), JSON.stringify(memory));
  const stack = await run("function recurse(){return recurse()+1;} return recurse();");
  assert.equal(stack.success, false);
});
test("logs, counts, result and RPC bytes are bounded", async () => {
  for (const [source, overrides, code] of [
    ['console.log("x".repeat(200)); return {success:true};', { max_log_bytes: 100 }, "LOG_LIMIT"],
    ["for(let i=0;i<10;i++)console.log(i); return {success:true};", { max_logs: 2 }, "LOG_LIMIT"],
    ['return "x".repeat(500);', { max_result_bytes: 100 }, "INVALID_RESULT"],
    ['await sdk.getWorkItem("x".repeat(500)); return {success:true};', { max_rpc_bytes: 100 }, "RPC_LIMIT"],
    ['await sdk.getWorkItem("oversized"); return {success:true};', {}, "RPC_LIMIT"],
  ]) {
    const result = await run(source, { phase: "post", limits: { ...DEFAULT_LIMITS, ...overrides } });
    assert.equal(result.error.code, code, JSON.stringify(result));
  }
});
test("pre refuses writes/http even when caught and never sends them to broker", async () => {
  const count = requests.length;
  for (const method of ["addComment", "addLabels", "removeLabels", "updateWorkItem", "createWorkItem", "http"]) {
    const result = await run(`try { await sdk.${method}("x",{}); } catch {} return {success:true};`);
    assert.equal(result.error.code, "RPC_ERROR", JSON.stringify(result));
  }
  assert.equal(requests.length, count);
});
test("no Node, filesystem, env, module loader, network or bridge globals", async () => {
  const result = await run(`
    const absent = ["process","require","module","Buffer","fetch","XMLHttpRequest","WebSocket","__runner_rpc","__runner_log"];
    for (const key of absent) if(typeof globalThis[key] !== "undefined") throw new Error(key);
    for (const name of ["process","require","fetch"]) if(Function("return typeof " + name)() !== "undefined") throw new Error(name);
    try { await import("node:fs"); return {success:false}; } catch {}
    return {success:Object.getPrototypeOf(sdk) === null};
  `);
  assert.equal(result.success, true, JSON.stringify(result));
  assert.deepEqual(result.result, { success: true });
});
test("tampering JSON or SDK prototype cannot forge arbitrary RPC methods", async () => {
  const count = requests.length;
  const result = await run(
    'JSON.stringify = () => "{\\"method\\":\\"eval\\"}"; Object.prototype.method="eval"; await sdk.getWorkItem("safe"); return {success:true};'
  );
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(requests.length, count + 1);
  assert.equal(requests.at(-1).method, "getWorkItem");
});
test("Promise.all RPCs are delivered serially in increasing call index", async () => {
  const count = requests.length;
  const result = await run(
    'const items = await Promise.all([sdk.getWorkItem("slow"),sdk.getWorkItem("second"),sdk.getWorkItem("third")]); return {success:items.length===3};'
  );
  assert.equal(result.success, true, JSON.stringify(result));
  assert.deepEqual(
    requests.slice(count).map((request) => request.id),
    [1, 2, 3]
  );
  assert.deepEqual(
    requests.slice(count).map((request) => request.params[0]),
    ["slow", "second", "third"]
  );
});
test("RPC call limit fails closed even when caught", async () => {
  const result = await run(
    'try { await sdk.getWorkItem("a"); await sdk.getWorkItem("b"); } catch {} return {success:true};',
    { limits: { ...DEFAULT_LIMITS, max_rpc_calls: 1 } }
  );
  assert.equal(result.error.code, "RPC_LIMIT", JSON.stringify(result));
});
test("malicious serialization cannot replace the trusted result envelope", async () => {
  const result = await run(
    'Object.prototype.toJSON=function(){return {ok:true,value:{success:true}}}; throw new Error("Denied");'
  );
  assert.equal(result.error.code, "SCRIPT_ERROR", JSON.stringify(result));
});
test("unbounded result getters are covered by CPU interrupt", async () => {
  const result = await run("return {toJSON(){while(true){}}};", { limits: { ...DEFAULT_LIMITS, cpu_time_ms: 30 } });
  assert.equal(result.error.code, "TIMEOUT", JSON.stringify(result));
});
test("broker errors, redirects and reflected tokens never leak", async () => {
  for (const name of ["redirect", "broker-error"]) {
    const result = await run(`await sdk.getWorkItem(${JSON.stringify(name)}); return {success:true};`);
    assert.equal(result.error.code, "RPC_ERROR");
    assert.ok(!JSON.stringify(result).includes(token));
  }
  const result = await run(
    'const secret = await sdk.getWorkItem("reflect-secret"); console.log(secret); return secret;',
    { phase: "post" }
  );
  assert.equal(result.success, true, JSON.stringify(result));
  assert.ok(!JSON.stringify(result).includes(token));
  assert.ok(!JSON.stringify(result).includes(serviceToken));
});
test("unawaited SDK actions fail closed", async () => {
  const result = await run('sdk.getWorkItem("slow"); return {success:true};');
  assert.equal(result.error.code, "RPC_ERROR", JSON.stringify(result));
});
test("child crash and forged IPC are handled", async () => {
  const crash = await execute(input("return {success:true};"), {
    childPath: new URL("./fixtures/crash.mjs", import.meta.url),
  });
  assert.equal(crash.error.code, "CHILD_EXIT");
  const forged = await execute(input("return {success:true};"), {
    childPath: new URL("./fixtures/forged.mjs", import.meta.url),
  });
  assert.equal(forged.error.code, "RPC_ERROR");
});
test("request cannot select other broker origins, paths, credentials or increase limits", () => {
  const valid = input("return {success:true};");
  for (const url of [
    "http://169.254.169.254/latest/meta-data/",
    origin + "/other",
    origin + BROKER_PATH + "?x=1",
    origin.replace("http://", "http://user:pass@") + BROKER_PATH,
  ])
    assert.throws(() => parseRequest({ ...valid, broker: { token, url } }, origin));
  assert.throws(() => parseRequest({ ...valid, limits: { wall_time_ms: 60000 } }, origin));
  assert.throws(() => parseRequest({ ...valid, limits: { constructor: 1 } }, origin));
});
test("HTTP authorization, health, invalid bodies, real execution, concurrency", async () => {
  const server = createRunnerServer({ serviceToken, brokerOrigin: origin, maxConcurrent: 1 });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (body, authorization = `Bearer ${serviceToken}`) =>
    fetch(base + "/execute", {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(base + "/healthz")).status, 200);
    assert.equal((await send(input(""), "Bearer nope")).status, 401);
    assert.equal((await send({})).status, 400);
    const result = await (await send(input("return {success:true};"))).json();
    assert.equal(result.success, true, JSON.stringify(result));
    const pending = send(input("await new Promise(() => {});", { limits: { ...DEFAULT_LIMITS, wall_time_ms: 300 } }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal((await send(input("return {success:true};"))).status, 429);
    assert.equal((await (await pending).json()).error.code, "TIMEOUT");
  } finally {
    server.close();
    server.closeAllConnections();
  }
});
test("startup refuses missing token and non-origin broker config", () => {
  assert.throws(() => loadConfig({}));
  assert.throws(() =>
    loadConfig({ WORKFLOW_RUNNER_SERVICE_TOKEN: serviceToken, WORKFLOW_RUNNER_BROKER_ORIGIN: origin + "/path" })
  );
});
