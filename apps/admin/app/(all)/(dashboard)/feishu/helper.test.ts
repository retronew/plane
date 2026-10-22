import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFeishuPayload, getFeishuErrorCode } from "./helper";

const emptyCallbackSecrets = { FEISHU_VERIFICATION_TOKEN: "", FEISHU_ENCRYPT_KEY: "" };

test("blank secret is omitted so disabling preserves stored credentials", () => {
  assert.deepEqual(
    buildFeishuPayload({
      ...emptyCallbackSecrets,
      FEISHU_ENABLED: false,
      FEISHU_APP_ID: " cli_test ",
      FEISHU_APP_SECRET: "",
    }),
    {
      FEISHU_ENABLED: "0",
      FEISHU_APP_ID: "cli_test",
    }
  );
});

test("replacement secret is sent exactly as entered", () => {
  assert.deepEqual(
    buildFeishuPayload({
      ...emptyCallbackSecrets,
      FEISHU_ENABLED: true,
      FEISHU_APP_ID: "cli_test",
      FEISHU_APP_SECRET: "new-secret",
    }),
    {
      FEISHU_ENABLED: "1",
      FEISHU_APP_ID: "cli_test",
      FEISHU_APP_SECRET: "new-secret",
    }
  );
});

test("callback secrets can be replaced independently without resending app credentials", () => {
  assert.deepEqual(
    buildFeishuPayload({
      FEISHU_ENABLED: true,
      FEISHU_APP_ID: "cli_test",
      FEISHU_APP_SECRET: "",
      FEISHU_VERIFICATION_TOKEN: "new-token",
      FEISHU_ENCRYPT_KEY: "new-key",
    }),
    {
      FEISHU_ENABLED: "1",
      FEISHU_APP_ID: "cli_test",
      FEISHU_VERIFICATION_TOKEN: "new-token",
      FEISHU_ENCRYPT_KEY: "new-key",
    }
  );
});

test("whitespace-only secrets are omitted to preserve saved values", () => {
  assert.deepEqual(
    buildFeishuPayload({
      FEISHU_ENABLED: true,
      FEISHU_APP_ID: "cli_test",
      FEISHU_APP_SECRET: " ",
      FEISHU_VERIFICATION_TOKEN: "\t",
      FEISHU_ENCRYPT_KEY: "  ",
    }),
    { FEISHU_ENABLED: "1", FEISHU_APP_ID: "cli_test" }
  );
});

test("only structured server error codes are accepted", () => {
  assert.equal(getFeishuErrorCode({ response: { data: { code: "account_not_bound" } } }), "account_not_bound");
  assert.equal(getFeishuErrorCode({ response: { data: { code: 123 } } }), undefined);
  assert.equal(getFeishuErrorCode(new Error("network failure")), undefined);
});
