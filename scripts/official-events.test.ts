import assert from "node:assert/strict";
import { test } from "node:test";
import { filterEventsByLocation, getUpcomingEvents, officialEvents, searchOfficialEvents } from "../lib/official-events";
import { getScheduleLabelsForDate } from "../lib/calendar";
import { searchAndAnswer } from "../lib/server/search";

test("actual teaching dates are separate from broad listing and ambiguous registration dates", () => {
  const event = officialEvents.find((item) => item.id === "seongnam-event-6553")!;
  assert.deepEqual(getScheduleLabelsForDate(event, "2026-11-24"), ["행사일"]);
  assert.deepEqual(getScheduleLabelsForDate(event, "2026-11-25"), ["행사일"]);
  assert.deepEqual(getScheduleLabelsForDate(event, "2026-11-08"), []);
  assert.equal(event.closingDate, null);
});

test("weekly recruitment does not become a fictitious event date", () => {
  assert.equal(searchOfficialEvents("이번 주 행사 있어?", "2026-11-08").length, 0);
  const events = searchOfficialEvents("이번 주 모집 있어?", "2026-11-08");
  assert.equal(events.length, 1);
  assert.equal(events[0].eventDate, "2026-11-23");
  assert.deepEqual(getScheduleLabelsForDate(events[0], "2026-11-08"), []);
  assert.deepEqual(getScheduleLabelsForDate(events[0], "2026-11-20"), []);
  assert.deepEqual(getScheduleLabelsForDate(events[0], "2026-11-23"), ["행사일"]);
});

test("unknown first-come closing date is not treated as an active recruitment window", () => {
  assert.equal(searchOfficialEvents("이번 주 결혼 강좌", "2026-11-08").length, 0);
  assert.equal(searchOfficialEvents("11월 결혼 강좌", "2026-11-08").length, 1);
  assert.equal(getUpcomingEvents("2026-11-26").length, 0);
});

test("no checked events falls back to an official link without claiming no events exist", async () => {
  const result = await searchAndAnswer({ question: "이번 주 행사 있어?", location: "경기도 성남시" }, { today: "2026-12-01", generateAnswer: async () => { throw new Error("must not call LLM"); } });
  assert.equal(result.status, "link_only");
  if (result.status === "link_only") assert.match(result.message, /실제 행사가 없다는 뜻은 아니며/u);
});

test("events have unique source links and explicit metadata-only source conditions", () => {
  assert.equal(new Set(officialEvents.map((event) => event.id)).size, 3);
  for (const event of officialEvents) {
    assert.equal(new URL(event.sourceUrl).hostname, "www.seongnam.go.kr");
    assert.equal(event.terms, "KOGL-4");
    assert.ok(!("body" in event) && !("image" in event));
  }
});

test("Jungwon events only appear for Jungwon selections while city events remain in every district", () => {
  for (const district of ["수정구", "중원구", "분당구"]) {
    const events = filterEventsByLocation(officialEvents, `경기도 성남시 ${district}`);
    assert.equal(events.some((event) => event.id === "seongnam-event-6553"), district === "중원구");
    assert.ok(events.some((event) => event.id === "seongnam-event-6555"));
    assert.ok(events.some((event) => event.id === "seongnam-event-6554"));
  }
  assert.equal(filterEventsByLocation(officialEvents, "경기도 성남시").length, 3);
  assert.equal(filterEventsByLocation(officialEvents, "서울특별시 중구").length, 0);
});

test("calendar dates and home upcoming list receive the same region-filtered records", () => {
  const localEvents = filterEventsByLocation(officialEvents, "경기도 성남시 분당구 서현1동");
  assert.ok(!getUpcomingEvents("2026-11-08", localEvents).some((event) => event.id === "seongnam-event-6553"));
  assert.ok(localEvents.every((event) => getScheduleLabelsForDate(event, "2026-11-24").length === 0));
});

test("an explicitly named event district overrides selected neighborhood for search", async () => {
  const input = { question: "11월 은행골 행사", location: "경기도 성남시 분당구 서현1동" };
  const selected = await searchAndAnswer(input, { today: "2026-11-08" });
  assert.equal(selected.status, "link_only");
  const explicit = await searchAndAnswer({ ...input, question: "11월 중원구 은행골 행사" }, { today: "2026-11-08" });
  assert.equal(explicit.status, "event_results");
  if (explicit.status === "event_results") assert.equal(explicit.events[0].id, "seongnam-event-6553");
});
