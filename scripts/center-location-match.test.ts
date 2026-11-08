import assert from "node:assert/strict";
import { test } from "node:test";
import { matchCenterLocation } from "../lib/center-location-match";
import centers from "../lib/server/seongnam-centers.json";

const center = { centerName: "은행1동행정복지센터", district: "중원구", address: "경기도 성남시 중원구 은행로 85 (은행동)" };
const item = { title: "<b>은행1동</b> 주민센터", roadAddress: "경기도 성남시 중원구 은행로 85", mapx: "1271689061", mapy: "374521125" };

test("matches official center name and road address before using coordinates", () => {
  assert.deepEqual(matchCenterLocation(center, { items: [item] }), {
    name: center.centerName, address: center.address, latitude: "37.4521125", longitude: "127.1689061",
  });
});

test("supports all 50 dataset centers rather than a single hardcoded center", () => {
  for (const record of centers.centers) {
    assert.ok(matchCenterLocation(record, { items: [{
      title: record.centerName, roadAddress: record.address.replace(/\([^)]*\)/g, "").trim(),
      mapx: "1271000000", mapy: "374000000",
    }] }));
  }
});

test("rejects wrong center, wrong street, wrong region and ambiguous candidates", () => {
  for (const changed of [{ title: "은행2동행정복지센터" }, { roadAddress: "경기도 성남시 중원구 은행로 86" }, { roadAddress: "서울특별시 은행로 85" }, { mapx: "0", mapy: "0" }]) {
    assert.equal(matchCenterLocation(center, { items: [{ ...item, ...changed }] }), undefined);
  }
  assert.equal(matchCenterLocation(center, { items: [item, item] }), undefined);
  assert.equal(matchCenterLocation(center, { items: [] }), undefined);
  assert.equal(matchCenterLocation(center, null), undefined);
});
