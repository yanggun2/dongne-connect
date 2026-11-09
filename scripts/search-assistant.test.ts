import assert from "node:assert/strict";
import { test } from "node:test";
import { createSearchAssistant } from "../lib/server/search-assistant";
import type { SearchResult } from "../lib/search-types";

const input = { question: "궁금한 우리 동네 이야기", location: "경기도 성남시 중원구 은행1동" };
const none: SearchResult = { status: "insufficient", message: "확인된 자료 없음", sources: [] };

test("every submitted topic reaches the assistant, without turning unknown regions or questions into facts", async () => {
  const seen: unknown[] = [];
  const search = createSearchAssistant({ enabled: () => true, generate: async (context) => {
    seen.push(context); return context.evidence.length ? "공식 자료를 확인해 주세요." : "확인된 자료가 없어요. 질문을 구체화해 주세요.";
  } });
  for (const question of ["안녕", "우리 동네 쓰레기 언제 버려?", "은행1동 주민센터 어디야?", "성남시 공공시설 알려줘", "이번 주 행사 있어?", "주요 공지", "서울 맛집 추천해줘"]) {
    const result = await search({ ...input, question });
    assert.ok(result.assistant);
  }
  assert.equal(seen.length, 7);
  const unknown = seen[6] as { evidence: unknown[]; location: string };
  assert.equal(unknown.evidence.length, 0);
  assert.equal(unknown.location, input.location);
  const waste = seen[1] as { evidence: unknown[] };
  assert.equal(waste.evidence.length, 0, "PDF-derived guidance must never be model input");
  const center = seen[2] as { evidence: { content: string }[] };
  assert.match(center.evidence[0].content, /은행1동/);
  assert.match(center.evidence[0].content, /nearestVerified/);
});

test("unknown evidence is explicit, restricted event/notice content is excluded and cards survive", async () => {
  const contexts: { evidence: { content: string }[] }[] = [];
  const search = createSearchAssistant({ enabled: () => true, generate: async (context) => {
    contexts.push(context); return "아래 공식 목록을 확인해 주세요.";
  } });
  const events = await search({ ...input, question: "행사 알려줘" });
  assert.equal(events.status, "event_results");
  assert.equal(contexts[0].evidence.length, 0);
  const notices = await search({ ...input, question: "공지 알려줘" });
  assert.equal(notices.status, "notice_results");
  assert.ok(contexts[1].evidence.every((field) => !/야간비행|노후계획/.test(field.content)));
});

test("cache merges simultaneous requests, expires, separates neighborhoods and leaves pagination static", async () => {
  let calls = 0, time = Date.now();
  const search = createSearchAssistant({ enabled: () => true, now: () => time, retrieve: async () => none,
    generate: async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 5)); return "확인된 자료가 없어요."; } });
  await Promise.all([search(input), search(input), search(input)]);
  assert.equal(calls, 1);
  await search(input); assert.equal(calls, 1);
  await search({ ...input, location: "경기도 성남시 분당구 정자3동" }); assert.equal(calls, 2);
  await search({ ...input, page: 2 }); assert.equal(calls, 2);
  time += 120_001; await search(input); assert.equal(calls, 3);
});

test("disabled, invalid, failed, linked and timed-out requests keep original results without retries or cached errors", async () => {
  let calls = 0;
  const disabled = createSearchAssistant({ enabled: () => false, retrieve: async () => none,
    generate: async () => { calls++; return "호출되면 안 됩니다"; } });
  assert.deepEqual(await disabled(input), none); assert.equal(calls, 0);
  const failed = createSearchAssistant({ enabled: () => true, retrieve: async () => none,
    generate: async () => { calls++; throw new Error("PRIVATE_DETAIL"); } });
  assert.deepEqual(await failed(input), none); assert.equal(calls, 1);
  assert.deepEqual(await failed(input), none); assert.equal(calls, 2);
  const linked = createSearchAssistant({ enabled: () => true, retrieve: async () => none, generate: async () => "https://invented.invalid" });
  assert.deepEqual(await linked(input), none);
  const timeout = createSearchAssistant({ enabled: () => true, retrieve: async () => none,
    timeoutMs: 5, generate: () => new Promise(() => {}) });
  assert.deepEqual(await timeout(input), none);
  assert.deepEqual(await failed({ ...input, question: "가".repeat(501) }), none); assert.equal(calls, 2);
});

test("concurrent unique generations are capped at four", async () => {
  let release!: () => void, calls = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const search = createSearchAssistant({ enabled: () => true, retrieve: async () => none,
    generate: async () => { calls++; await gate; return "확인된 자료가 없어요."; } });
  const first = [0, 1, 2, 3].map((id) => search({ ...input, question: `질문 ${id}` }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(await search({ ...input, question: "다섯 번째 질문" }), none);
  assert.equal(calls, 4); release(); await Promise.all(first);
});
