import assert from "node:assert/strict";
import { test } from "node:test";
import { seongnamCenters } from "../lib/server/seongnam-centers";
import { formatWasteAnswer, getWasteGuidance, getWasteProvider, isWasteGuideQuestion, parseWasteQuestion, wasteCategories, wasteProviders } from "../lib/waste-guide";
import { searchAndAnswer } from "../lib/server/search";

test("provider table matches all 50 official administrative dongs exactly once", () => {
  const assignments = wasteProviders.flatMap((provider) => provider.dongs.map((dong) => `${provider.district}|${dong}`));
  assert.equal(assignments.length, 50);
  assert.equal(new Set(assignments).size, 50);
  assert.deepEqual([...assignments].sort(), seongnamCenters.map((center) => center.id).sort());
  for (const center of seongnamCenters) assert.ok(getWasteProvider(`경기도 성남시 ${center.district} ${center.dong}`));
});

test("provider changes by dong, never by partial name or guessed district", () => {
  assert.equal(getWasteProvider("경기도 성남시 중원구 은행1동")?.name, "나눔환경");
  assert.equal(getWasteProvider("경기도 성남시 중원구 은행2동")?.name, "엘앤케이비즈");
  assert.equal(getWasteProvider("경기도 성남시 수정구 은행1동"), undefined);
  assert.equal(getWasteProvider("경기도 성남시"), undefined);
  assert.equal(getWasteProvider("경기도 성남시 중원구 은행"), undefined);
});

test("food waste methods distinguish housing types without assuming a building type", () => {
  const location = "경기도 성남시 중원구 은행1동";
  const single = getWasteGuidance(location, "food", "single")!;
  const apartment = getWasteGuidance(location, "food", "apartment")!;
  const both = getWasteGuidance(location, "food", "unknown")!;
  assert.ok(single.methods.some((method) => method.includes("노란색")));
  assert.ok(!apartment.methods.some((method) => method.includes("노란색")));
  assert.ok(apartment.methods.some((method) => method.includes("관리사무소")));
  assert.equal(both.methods.length, 3);
});

test("disposal time and collection time are distinct and conflicting weekend details remain cautions", () => {
  const guide = getWasteGuidance("경기도 성남시")!;
  assert.match(guide.disposalTime, /일몰.*5시/u);
  assert.match(guide.collectionTime!, /6시.*3시/u);
  assert.ok(guide.cautions.some((caution) => caution.includes("표기가 달라")));
  assert.equal(guide.generationAllowed, false);
  assert.equal(getWasteGuidance("서울특별시"), null);
});

test("bulky waste guidance never presents undated fee table as current prices", () => {
  const guide = getWasteGuidance("경기도 성남시", "bulky")!;
  assert.equal(guide.collectionTime, null);
  assert.ok(guide.methods.some((method) => method.includes("신고접수번호")));
  assert.ok(guide.cautions.some((caution) => caution.includes("확정하지")));
  assert.ok(!JSON.stringify(guide).includes("8,000"));
  for (const category of wasteCategories) assert.ok(getWasteGuidance("경기도 성남시", category)!.pdfPages.length);
});

test("time-sensitive or non-household questions cannot use the basic guide", () => {
  for (const question of ["내일 쓰레기 배출", "11월 10일 쓰레기 배출", "추석 음식물 쓰레기 배출", "사업장 폐기물 처리", "건설 폐기물 처리", "폐의약품 쓰레기 배출"]) assert.equal(isWasteGuideQuestion(question), false);
  assert.equal(isWasteGuideQuestion("우리 동네 쓰레기 언제 버려?"), true);
  assert.deepEqual(parseWasteQuestion("아파트 음식물쓰레기 버리는 방법"), { category: "food", housing: "apartment" });
  assert.deepEqual(parseWasteQuestion("다세대 음식물쓰레기 배출방법"), { category: "food", housing: "unknown" });
  assert.deepEqual(parseWasteQuestion("단독주택과 아파트 음식물쓰레기 차이"), { category: "food", housing: "unknown" });
});

test("reviewed waste search returns matching housing and explicit dong without an LLM call", async () => {
  let calls = 0;
  const result = await searchAndAnswer({ question: "은행2동 아파트 음식물쓰레기 어떻게 배출해?", location: "경기도 성남시 중원구 은행1동" }, { generateAnswer: async () => { calls++; throw new Error("must not call"); } });
  assert.equal(result.status, "waste_results");
  if (result.status === "waste_results") {
    assert.match(result.answer, /은행2동/u);
    assert.match(result.answer, /관리사무소/u);
    assert.ok(!result.answer.includes("노란색"));
    assert.equal(result.sources[0].sourceUrl, "https://recycle.seongnam.go.kr/platforminfo/trash");
    assert.equal(result.regionName, "경기도 성남시 중원구 은행2동");
    assert.equal(result.category, "food");
    assert.equal(result.housing, "apartment");
    assert.equal(result.sources[0].dataAsOf, null);
  }
  assert.equal(calls, 0);
});

test("conversational answer states selected neighborhood and qualified times without inventing weekdays", () => {
  const answer = formatWasteAnswer(getWasteGuidance("경기도 성남시 분당구 정자3동")!);
  assert.match(answer, /경기도 성남시 분당구 정자3동/u);
  assert.match(answer, /일몰 후부터 다음 날 오전 5시까지/u);
  assert.match(answer, /오전 6시~오후 3시/u);
  assert.match(answer, /성남시 공통 안내/u);
  assert.match(answer, /책자와 웹 안내의 주말 표기가 달라/u);
  assert.ok(!answer.includes("월요일부터 토요일까지 배출"));
});

test("Seongnam waste document is not applied to another city's request", async () => {
  const result = await searchAndAnswer({ question: "서울 쓰레기 배출시간", location: "경기도 성남시 중원구 은행1동" });
  assert.equal(result.status, "region_mismatch");
});
