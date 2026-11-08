import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WasteGuide } from "../components/WasteGuide";

test("neighborhood card retains its controls and official source without a PDF download link", () => {
  const html = renderToStaticMarkup(<WasteGuide location="경기도 성남시 중원구 은행1동" />);
  assert.match(html, /나눔환경/u);
  assert.match(html, /tel:031-721-0436/u);
  assert.match(html, /배출시간/u);
  assert.match(html, /수거시간/u);
  assert.match(html, /recycle\.seongnam\.go\.kr\/platforminfo\/trash/u);
  assert.ok(!html.includes("echolife2025.pdf") && !html.includes("#page="));
  assert.match(html, /주택 유형/u);
  assert.ok(!html.includes("<img"));
});

test("apartment food-waste card renders apartment guidance without single-house bag instruction", () => {
  const html = renderToStaticMarkup(<WasteGuide location="경기도 성남시 분당구 서현1동" initialCategory="food" initialHousing="apartment" />);
  assert.match(html, /관리사무소/u);
  assert.match(html, /강산이앤에쓰/u);
  assert.ok(!html.includes("노란색"));
  assert.ok(html.includes('id="waste-info"'));
});
