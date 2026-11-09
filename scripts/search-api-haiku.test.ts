import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/search/route";
import { searchAndAnswer } from "../lib/server/search";

test("app search uses only approved real evidence with mocked SDK; disabled/error paths retain a dated source answer", async () => {
  const keys = ["LLM_SEARCH_ENABLED", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"] as const;
  const saved = keys.map((key) => process.env[key]);
  const originalFetch = globalThis.fetch;
  let calls = 0, fail = false;
  process.env.LLM_SEARCH_ENABLED = "true";
  process.env.LLM_API_KEY = "offline-dummy";
  process.env.LLM_BASE_URL = "https://example.invalid/v1";
  process.env.LLM_MODEL = "bedrock-haiku";
  globalThis.fetch = async (input, init) => {
    calls++;
    const request = new Request(input, init);
    assert.equal(request.url, "https://example.invalid/v1/chat/completions");
    const payload = await request.json();
    assert.equal(payload.model, "bedrock-haiku");
    assert.equal(payload.max_tokens, 400);
    assert.match(payload.messages[0].content, /근거가 없거나 질문과 맞지 않으면/);
    assert.match(payload.messages[0].content, /근거에 없는 부서명/);
    const evidence = JSON.parse(payload.messages[1].content).evidence;
    if (evidence.length === 0) {
      assert.equal(JSON.parse(payload.messages[1].content).location, "서울특별시");
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: "현재 해당 지역에 확인된 자료가 없어요." } }] });
    }
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].sourceId, "mois-waste-api-seongnam");
    assert.equal(evidence[0].id, "non-collection-sunday-holidays");
    assert.equal(evidence[0].dataAsOf, "2022-11-25");
    assert.ok(!JSON.stringify(payload).includes("seongnam-waste-booklet"));
    assert.ok(!JSON.stringify(payload).includes("offline-dummy"));
    if (fail) return Response.json({ error: { message: "PRIVATE_PROVIDER_DETAIL" } }, { status: 429 });
    return Response.json({ id: "offline", object: "chat.completion", created: 0, model: "bedrock-haiku", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "성남시 공통 안내에서 일요일과 공휴일은 수거하지 않는 것으로 확인돼요." } }] });
  };
  const query = async (question: string, location = "경기도 성남시 중원구 은행1동") => {
    const response = await POST(new NextRequest("http://localhost/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, location }) }));
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    const live = await query("우리 동네 일요일에 쓰레기 수거해?");
    assert.equal(calls, 1);
    assert.equal(live.status, "answered");
    assert.equal(live.answerMode, "source");
    assert.equal(live.assistant.grounded, true);
    assert.match(live.assistant.answer, /일요일과 공휴일/);
    assert.match(live.answer, /선택한 동의 배출 요일.*확인하지 않았/);
    assert.match(live.answer, /2022-11-25/);
    assert.deepEqual(live.sources[0].fieldIds, ["non-collection-sunday-holidays"]);
    assert.equal(live.sources[0].sourceUrl, "https://www.data.go.kr/data/15155080/openapi.do");
    fail = true;
    const fallback = await query("공휴일에 쓰레기 수거하나요?");
    assert.equal(calls, 2, "failed request must not retry");
    assert.equal(fallback.status, "answered");
    assert.equal(fallback.answerMode, "source");
    assert.match(fallback.answer, /일요일과 공휴일은 수거하지/);
    assert.ok(!JSON.stringify(fallback).includes("PRIVATE_"));
    delete process.env.LLM_SEARCH_ENABLED;
    const disabled = await query("일요일 쓰레기 수거하나요?");
    assert.equal(disabled.status, "answered");
    assert.equal(disabled.answerMode, "source");
    assert.equal(calls, 2);
    process.env.LLM_SEARCH_ENABLED = "true";
    const other = await query("일요일 쓰레기 수거해?", "서울특별시");
    assert.equal(other.status, "region_mismatch");
    assert.equal(other.assistant.grounded, false);
    for (const question of ["우리 동네 쓰레기 언제 버려?", "일요일에 쓰레기 배출해?", "오늘 공휴일인데 쓰레기 수거해?", "토요일과 일요일 쓰레기 수거해?", "공휴일 음식물 쓰레기 수거해?", "2026년 추석 공휴일 쓰레기 수거해?", "일요일 화학 폐기물 수거해?", "일요일 종이 분리수거해?"]) {
      const result = await searchAndAnswer({ question, location: "경기도 성남시 중원구 은행1동" });
      assert.ok(["waste_results", "insufficient"].includes(result.status));
    }
    assert.equal(calls, 3, "other-region question uses empty evidence; PDF and unverified details stay excluded");
    const longAnswer = await searchAndAnswer({ question: "일요일 쓰레기 수거해?", location: "경기도 성남시" }, { generateAnswer: async () => "가".repeat(3_000) });
    assert.equal(longAnswer.status, "answered");
    if (longAnswer.status === "answered") {
      assert.ok(longAnswer.answer.length <= 2_000);
      assert.match(longAnswer.answer, /2022-11-25/);
      assert.ok(longAnswer.answer.endsWith("공식 안내를 확인해 주세요."));
    }
    const timedOut = await searchAndAnswer({ question: "일요일 쓰레기 수거해?", location: "경기도 성남시" }, { timeoutMs: 5, generateAnswer: () => new Promise<string>(() => {}) });
    assert.equal(timedOut.status, "answered");
    if (timedOut.status === "answered") assert.match(timedOut.answer, /일요일과 공휴일은 수거하지/);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  }
});
