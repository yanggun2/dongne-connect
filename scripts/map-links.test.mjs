import assert from "node:assert/strict";
import { test } from "node:test";
import { getNaverWebDirectionsUrl, isUsableLocationAccuracy } from "../lib/map-links.ts";
import { getCenterMapDestination } from "../lib/center-map-reference.ts";

const destination = {
  name: "성남시청", address: "경기도 성남시", latitude: "37.4200267", longitude: "127.1267772",
};

test("unreliable or missing accuracy cannot be used as a route origin", () => {
  for (const accuracy of [NaN, Infinity, -1, 0, 1001, 100000]) assert.equal(isUsableLocationAccuracy(accuracy), false);
  for (const accuracy of [5, 100, 1000]) assert.equal(isUsableLocationAccuracy(accuracy), true);
});

test("a shared center location only applies to the matching id, name and address", () => {
  const center = { id: "중원구|은행1동", centerName: "은행1동행정복지센터", address: "경기도 성남시 중원구 은행로 85 (은행동)" };
  assert.equal(getCenterMapDestination(center)?.latitude, "37.4521125");
  assert.equal(getCenterMapDestination(center)?.longitude, "127.1689061");
  for (const changed of [{ id: "중원구|은행2동" }, { centerName: "다른 센터" }, { address: "다른 주소" }]) {
    assert.equal(getCenterMapDestination({ ...center, ...changed }), undefined);
  }
});

test("web directions coordinates match the supplied real NAVER share link", () => {
  const url = getNaverWebDirectionsUrl({ latitude: 37.4521125, longitude: 127.1689061 }, destination);
  assert.equal(url, `https://map.naver.com/p/directions/3zpFMp,2AHfpP,${encodeURIComponent("현재 위치")},,SIMPLE_POI/3znUbq,2AFTWH,${encodeURIComponent("성남시청")},,SIMPLE_POI/-/transit`);
  assert.ok(!url.includes("nmap:") && !url.includes("appname"));
});

test("missing destination coordinates and invalid origins do not produce routes", () => {
  const origin = { latitude: 37.45, longitude: 127.16 };
  for (const latitude of ["", " ", "NaN", "91"]) {
    assert.equal(getNaverWebDirectionsUrl(origin, { ...destination, latitude }), null);
  }
  for (const latitude of [NaN, Infinity, 91, -91]) {
    assert.equal(getNaverWebDirectionsUrl({ ...origin, latitude }, destination), null);
  }
  assert.equal(getNaverWebDirectionsUrl({ ...origin, longitude: 181 }, destination), null);
});

test("punctuation in names cannot alter route path structure", () => {
  const url = getNaverWebDirectionsUrl({ latitude: 37.45, longitude: 127.16 }, { ...destination, name: "시설,/이름?#" });
  const path = new URL(url).pathname;
  assert.equal(path.split("/").length, 7);
  assert.ok(path.includes(encodeURIComponent("시설©/이름?#")));
});
