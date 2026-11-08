import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../app/api/neighborhood-map/route";
import { distanceKm, facilityMapCategory, visibleTownPlaces, type TownMapData, type TownPlace } from "../lib/neighborhood-map";
import { getCoordinates } from "../lib/map-links";
import { resolveCenterLocation } from "../lib/center-location-client";

const center: TownPlace = { id: "center", name: "기준 센터", address: "성남시", latitude: "37.45", longitude: "127.16", category: "center", hours: "", closedDays: "", sourceUrl: "https://www.seongnam.go.kr/", dataAsOf: "2026-08-14" };
const near: TownPlace = { ...center, id: "near", name: "인근 시설", latitude: "37.46", category: "sports" };
const far: TownPlace = { ...near, id: "far", latitude: "37.50" };

test("nearby scope uses center distance, with inclusive center and no invented dong membership", () => {
  assert.equal(distanceKm(center, center), 0);
  assert.ok(distanceKm(center, near) > 1 && distanceKm(center, near) < 1.2);
  assert.deepEqual(visibleTownPlaces([far, near], center, "all", true).map((item) => item.id), ["center", "near"]);
  assert.deepEqual(visibleTownPlaces([far, near], center, "sports", true).map((item) => item.id), ["near"]);
  assert.equal(visibleTownPlaces([far, near], center, "all", false).length, 3);
});

test("missing or invalid coordinates cannot become nearby pins", () => {
  assert.deepEqual(visibleTownPlaces([near], undefined, "all", true), []);
  assert.equal(visibleTownPlaces([near], undefined, "all", false).length, 1);
  assert.equal(visibleTownPlaces([{ ...near, latitude: "" }], center, "sports", false).length, 0);
  assert.equal(distanceKm(center, { ...near, longitude: "NaN" }), Infinity);
});

test("library/park categories use explicit known records, not dong or arbitrary name substrings", () => {
  assert.equal(facilityMapCategory("수정도서관 미디어 창작실", "기타"), "library");
  assert.equal(facilityMapCategory("단대근린공원 다목적구장", "기타"), "outdoor");
  assert.equal(facilityMapCategory("성남시청 한누리", "회의실"), "space");
  assert.equal(facilityMapCategory("성남종합운동장 인조잔디구장", "기타"), "sports");
});

test("local map endpoint validates selected neighborhood and preserves all valid facilities without external calls", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected external call"); };
  try {
    const response = GET(new NextRequest("http://localhost/api/neighborhood-map?locationId=" + encodeURIComponent("중원구|은행1동")));
    const data: TownMapData = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.center?.id, "중원구|은행1동");
    assert.equal(data.facilities.length, 82);
    assert.equal(new Set(data.facilities.map((item) => item.id)).size, 82);
    for (const item of data.facilities) { assert.ok(getCoordinates(item)); assert.ok(item.address); assert.match(item.sourceUrl, /^https?:\/\//); }
    const city: TownMapData = await GET(new NextRequest("http://localhost/api/neighborhood-map")).json();
    assert.equal(city.center, null);
    assert.equal(city.facilities.length, data.facilities.length);
    assert.equal(GET(new NextRequest("http://localhost/api/neighborhood-map?locationId=unknown")).status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test("center client deduplicates parallel home/search lookups and rejects mismatched destinations", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const identity = { id: "test-center", centerName: "테스트 센터", address: "성남시 테스트 주소" };
  globalThis.fetch = async () => { calls++; return Response.json({ destination: { ...center, name: identity.centerName, address: identity.address } }); };
  try {
    const [first, second] = await Promise.all([resolveCenterLocation(identity), resolveCenterLocation(identity)]);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.ok(first);
    assert.equal(await resolveCenterLocation({ ...identity, id: "wrong-center", address: "다른 주소" }), undefined);
    assert.equal(await resolveCenterLocation({ ...identity, id: "wrong-center", address: "다른 주소" }), undefined);
    assert.equal(calls, 3, "failed resolution must remain retryable");
  } finally { globalThis.fetch = originalFetch; }
});

test("known center reference requires matching official identity and no search API", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected external call"); };
  try {
    const result = await resolveCenterLocation({ id: "중원구|은행1동", centerName: "은행1동행정복지센터", address: "경기도 성남시 중원구 은행로 85 (은행동)" });
    assert.equal(result?.latitude, "37.4521125");
  } finally { globalThis.fetch = originalFetch; }
});
