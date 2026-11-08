import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";

// Temporary tool dependency; no application dependency or credentials required.
const toolRoot = process.env.DONGNE_BROWSER_TOOL_ROOT || join(tmpdir(), "dongne-browser-check");
const { chromium } = createRequire(join(toolRoot, "package.json"))("playwright");
const base = process.env.DONGNE_VERIFY_URL || "http://127.0.0.1:3107";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "local verification only");
const artifacts = join(tmpdir(), "dongne-browser-results");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [375, 820, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, locale: "ko-KR", timezoneId: "Asia/Seoul", serviceWorkers: "block" });
    const errors = [], blocked = [];
    let forceEmpty = false;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) { blocked.push(url.hostname); await route.abort(); return; }
      if (forceEmpty && url.pathname === "/api/neighborhood-map") {
        const response = await route.fetch();
        const data = await response.json();
        await route.fulfill({ response, json: { ...data, facilities: [] } });
        return;
      }
      await route.continue();
    });
    await context.addInitScript(() => {
      const markers = new Set();
      class MapMock {
        constructor(host) { this.host = host; host.style.background = "repeating-linear-gradient(45deg,#edf6f3,#edf6f3 25px,#e5efec 25px,#e5efec 50px)"; host.setAttribute("aria-label", "지도 SDK 모의화 · 실제 지도 아님"); }
        setCenter() {} setZoom() {} fitBounds() {}
        destroy() { this.host.replaceChildren(); }
      }
      class MarkerMock {
        constructor(options) { this.title = options.title; this.map = options.map; markers.add(this); }
        setMap(map) { this.map = map; if (!map) markers.delete(this); }
        setZIndex() {}
      }
      window.naver = { maps: { Map: MapMock, LatLng: class {}, Marker: MarkerMock, Event: { addListener(marker, event, listener) { if (event === "click") marker.click = listener; } } } };
      window.__testMapClick = (name) => { const marker = [...markers].find((item) => item.title === name); if (!marker) throw new Error("missing marker"); marker.click(); };
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-11-08T12:00:00+09:00"));
    const loaded = async () => {
      await page.waitForFunction(() => document.querySelectorAll('[aria-label="기본 검색 지역 선택"] option').length === 51);
      await page.locator("#town-map .town-map-list button").first().waitFor();
    };
    await page.goto(base);
    await loaded();
    await page.getByRole("combobox", { name: "행정동 검색" }).fill("은행");
    const suggestions = page.getByRole("listbox", { name: "행정동 검색 결과" });
    assert.equal(await suggestions.getByRole("option").count(), 2);
    await Promise.all([page.waitForURL(/neighborhood=/), suggestions.getByRole("option", { name: /은행1동/ }).click()]);
    await loaded();
    const town = page.locator("#town-map");
    await town.locator(".town-map-detail h4").filter({ hasText: "은행1동" }).waitFor();
    for (let repeat = 0; repeat < 4; repeat++) {
      for (const name of ["체육시설", "도서관 공간", "공원·야외", "대관공간", "주민센터", "전체"]) {
        await town.getByRole("button", { name, exact: true }).click();
      }
      await town.getByRole("button", { name: "성남시 전체", exact: true }).click();
      await town.getByRole("button", { name: "주민센터 주변 3km", exact: true }).click();
    }
    const first = town.locator(".town-map-list button").first();
    await first.click();
    const facilityName = await town.locator(".town-map-detail h4").innerText();
    await town.getByRole("button", { name: "전체", exact: true }).click();
    await page.evaluate((name) => window.__testMapClick(name), facilityName);
    assert.equal(await town.locator(".town-map-detail h4").innerText(), facilityName);
    const searchHref = await town.getByRole("link", { name: "출발지 직접 선택", exact: true }).getAttribute("href");
    assert.equal(new URL(searchHref).hostname, "map.naver.com");
    assert.ok(decodeURIComponent(searchHref).includes(facilityName));
    const popupEvent = context.waitForEvent("page");
    const webRequest = context.waitForEvent("request", { predicate: (request) => request.url().startsWith("https://map.naver.com/") });
    await town.getByRole("link", { name: "출발지 직접 선택", exact: true }).click();
    const popup = await popupEvent;
    assert.equal((await webRequest).url(), searchHref);
    await popup.close();
    for (const link of await page.locator('a[href^="nmap:"],a[href*="play.google.com"],a[href*="apps.apple.com"]').all()) assert.fail("app install/deep link present");
    const waste = page.locator("#waste-info");
    await waste.getByRole("button", { name: "음식물", exact: true }).click();
    await waste.getByLabel("주택 유형").selectOption("apartment");
    assert.ok((await waste.innerText()).includes("공동주택"));
    assert.equal(await waste.locator('a[href*=".pdf"]').count(), 0);
    const calendar = page.locator(".community-calendar");
    assert.equal(await calendar.locator(".calendar-date").count(), 7);
    await calendar.getByRole("button", { name: "월간 달력 보기", exact: true }).click();
    await calendar.getByRole("button", { name: /2026년 11월 23일/ }).click();
    assert.ok((await calendar.locator(".calendar-schedule-list").innerText()).includes("중독"));
    await calendar.getByRole("button", { name: "주간 보기", exact: true }).click();
    assert.equal(await calendar.locator(".calendar-date").count(), 7);
    await page.getByPlaceholder("우리 동네 쓰레기 언제 버려?").fill("우리 동네 쓰레기 언제 버려?");
    await page.getByRole("button", { name: "검색하기", exact: true }).click();
    await page.locator(".answer-block").waitFor();
    assert.match(await page.locator(".answer-block").innerText(), /은행1동/);
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(overflow.document <= overflow.viewport + 1, `horizontal overflow at ${width}: ${JSON.stringify(overflow)}`);
    await page.screenshot({ path: join(artifacts, `home-${width}.png`), fullPage: true });
    await town.screenshot({ path: join(artifacts, `map-${width}.png`) });
    await calendar.screenshot({ path: join(artifacts, `calendar-${width}.png`) });
    forceEmpty = true;
    await page.reload();
    await loaded();
    await town.getByRole("button", { name: "체육시설", exact: true }).click();
    await town.locator(".map-empty-state strong").waitFor();
    for (let i = 0; i < 4; i++) {
      await town.getByRole("button", { name: "주민센터", exact: true }).click();
      await town.locator(".town-map-list button").first().waitFor();
      await town.getByRole("button", { name: "체육시설", exact: true }).click();
      await town.locator(".map-empty-state strong").waitFor();
    }
    await page.getByRole("combobox", { name: "기본 검색 지역 선택", exact: true }).selectOption("분당구|정자3동");
    await town.getByText("주민센터 위치를 확인하지 못했어요.", { exact: false }).waitFor();
    assert.equal(await town.locator(".town-map-list button").count(), 0);
    assert.ok((await town.getByRole("link", { name: /웹 지도 검색/ }).getAttribute("href")).startsWith("https://map.naver.com/p/search/"));
    await town.getByRole("button", { name: "성남시 전체", exact: true }).click();
    forceEmpty = false;
    await page.getByRole("combobox", { name: "기본 검색 지역 선택", exact: true }).selectOption("citywide");
    await loaded();
    assert.deepEqual(errors, [], `runtime errors at ${width}`);
    assert.ok(blocked.every((host) => ["fonts.googleapis.com", "map.naver.com"].includes(host)), "unexpected outbound request (blocked)");
    results.push({ width, status: "passed", runtimeErrors: errors.length, externalRequestsSent: 0, blockedFontRequests: blocked.filter((host) => host === "fonts.googleapis.com").length, interceptedWebMapNavigations: blocked.filter((host) => host === "map.naver.com").length, overflow, map: "mock SDK, actual NAVER not verified" });
    await context.close();
  }
  console.log(JSON.stringify({ results, screenshots: artifacts }, null, 2));
} finally { await browser.close(); }
