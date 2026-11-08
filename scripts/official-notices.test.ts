import assert from "node:assert/strict";
import { test } from "node:test";
import { officialNotices, searchOfficialNotices } from "../lib/official-notices";
import { searchAndAnswer } from "../lib/server/search";

test("notices retain verified dates, individual license types and direct detail links", () => {
  assert.equal(new Set(officialNotices.map((notice) => notice.id)).size, 3);
  assert.deepEqual(officialNotices.map((notice) => notice.license), ["KOGL-4", "KOGL-3", "KOGL-0"]);
  for (const notice of officialNotices) {
    assert.match(notice.sourceUrl, /^https:\/\/www\.seongnam\.go\.kr\/bbs010101\/\d+$/u);
    assert.ok(notice.publishedOn <= notice.checkedAt);
    assert.ok(!("body" in notice));
  }
});

test("known notice subjects filter metadata instead of showing all notices", () => {
  assert.equal(searchOfficialNotices("야간비행 공지")[0].id, "seongnam-notice-405873");
  assert.equal(searchOfficialNotices("마인드피트니스 공지").length, 1);
});

test("notice search keeps city source scope distinct from selected dong", async () => {
  const result = await searchAndAnswer({ question: "서울공항 야간비행", location: "경기도 성남시 중원구 은행1동" }, { generateAnswer: async () => { throw new Error("must not call LLM"); } });
  assert.equal(result.status, "notice_results");
  if (result.status === "notice_results") {
    assert.equal(result.notices.length, 1);
    assert.match(result.message, /선택한 동에만 적용되는 공지가 아니며/u);
    assert.equal(result.sources[0].dataAsOf, null);
  }
});

test("an explicitly requested Seoul notice still cannot use Seongnam notices", async () => {
  const result = await searchAndAnswer({ question: "서울특별시 공지 알려줘", location: "경기도 성남시" });
  assert.equal(result.status, "insufficient");
});
