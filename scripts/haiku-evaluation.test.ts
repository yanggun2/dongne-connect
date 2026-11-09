import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { describeHaikuPlan, HAIKU_MODEL, runHaikuEvaluation } from "../lib/server/haiku-evaluation";

test("guide model alias, fixed synthetic data and strict request limit are used; other regions never reach transport", async () => {
  const plan = describeHaikuPlan();
  assert.equal(plan.model, "bedrock-haiku");
  assert.equal(plan.caseCount, 3);
  assert.equal(plan.maxRequests, 2);
  let calls = 0;
  const results = await runHaikuEvaluation(async (request, options) => {
    calls++;
    assert.equal(request.model, HAIKU_MODEL);
    assert.equal(request.max_tokens, 400);
    assert.equal(options.maxRetries, 0);
    assert.equal(options.timeout, 15_000);
    assert.ok(!options.signal.aborted);
    const payload = JSON.parse(request.messages[1].content);
    assert.equal(payload.evidence.length, 1);
    assert.equal(payload.evidence[0].sourceId, "synthetic-city-guide");
    assert.match(payload.evidence[0].content, /실제 지역에 적용되지 않는 가상 테스트 자료/);
    assert.ok(!payload.question.includes("달빛시"));
    return { choices: [{ message: { content: "테스트 답변" }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } };
  });
  assert.equal(calls, 2);
  assert.deepEqual(results.map((result) => result.status), ["needs_review", "needs_review", "blocked_region"]);
  assert.deepEqual(results[0].usage, { inputTokens: 100, outputTokens: 10 });
});

test("budget and provider failures stop all remaining requests without exposing raw details", async () => {
  for (const message of ["Budget has been exceeded: PRIVATE_DETAIL", "PRIVATE_ENDPOINT_FAILURE"]) {
    let calls = 0;
    const results = await runHaikuEvaluation(async () => { calls++; throw new Error(message); });
    assert.equal(calls, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, "failed");
    assert.equal(results[0].failure, message.startsWith("Budget") ? "budget_exceeded" : "request_failed");
    assert.ok(!JSON.stringify(results).includes("PRIVATE_"));
  }
});

test("empty, cut-off and linked responses stop evaluation instead of spending another request", async () => {
  for (const choice of [
    { message: { content: "" }, finish_reason: "stop" },
    { message: { content: "잘린 답변" }, finish_reason: "length" },
    { message: { content: "https://example.invalid/model-link" }, finish_reason: "stop" },
  ]) {
    let calls = 0;
    const results = await runHaikuEvaluation(async () => { calls++; return { choices: [choice] }; });
    assert.equal(calls, 1);
    assert.equal(results[0].status, "failed");
    assert.equal(results[0].reason, "invalid_response");
    assert.equal(results[0].answer, undefined);
  }
});

test("failure diagnostics expose only validated HTTP status and fixed categories", async () => {
  const examples = [
    { error: Object.assign(new Error("PRIVATE_KEY_ENDPOINT_BODY"), { status: 401 }), reason: "http_error", status: 401 },
    { error: Object.assign(new Error("PRIVATE_KEY_ENDPOINT_BODY"), { status: "PRIVATE_VALUE" }), reason: "unknown", status: undefined },
    { error: Object.assign(new Error("PRIVATE_KEY_ENDPOINT_BODY"), { name: "APIConnectionError" }), reason: "network_error", status: undefined },
    { error: Object.assign(new Error("PRIVATE_KEY_ENDPOINT_BODY"), { name: "APIConnectionTimeoutError" }), reason: "timeout", status: undefined },
  ];
  for (const example of examples) {
    const results = await runHaikuEvaluation(async () => { throw example.error; });
    assert.equal(results[0].reason, example.reason);
    assert.equal(results[0].httpStatus, example.status);
    assert.ok(!JSON.stringify(results).includes("PRIVATE_"));
  }
});

test("CLI defaults to plan only even with stored credentials; incomplete consent flags cannot call the model", () => {
  for (const args of [[], ["--live"], ["--acknowledge-cost"], ["--unknown"]]) {
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/test-llm.ts", ...args], {
      encoding: "utf8", timeout: 10_000,
      env: { ...process.env, LLM_API_KEY: "OFFLINE_PRIVATE_DUMMY", LLM_BASE_URL: "https://example.invalid/v1", LLM_SEARCH_ENABLED: "true" },
    });
    assert.ifError(result.error);
    assert.equal(result.status, args.length ? 1 : 0);
    assert.ok(!result.stdout.includes("OFFLINE_PRIVATE_DUMMY"));
    assert.ok(!result.stderr.includes("OFFLINE_PRIVATE_DUMMY"));
    assert.ok(!result.stdout.includes("example.invalid"));
    if (!args.length) { assert.match(result.stdout, /환경파일은 읽지 않습니다/); assert.match(result.stdout, /"maxRequests": 2/); }
  }
});
