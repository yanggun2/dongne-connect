import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSearchRateLimiter,
  searchAndAnswer,
  type EvidenceSource,
} from "../lib/server/search";
import {
  getKoreanDateKey,
  getMonthDateKeys,
  getScheduleLabelsForDate,
  getWeekDateKeys,
} from "../lib/calendar";
import { getNaverMapRouteUrl } from "../lib/map-links";
import {
  getNeighborhoodOptions,
  resolveResidentCenter,
  seongnamCenters,
} from "../lib/server/seongnam-centers";

const eligibleFixture: EvidenceSource = {
  id: "test-source",
  category: "waste",
  title: "테스트 전용 검증 자료",
  sourceName: "검색 테스트 fixture",
  sourceUrl: "https://example.invalid/test-fixture",
  regionName: "경기도 성남시",
  regionLevel: "city",
  managementArea: null,
  publishedAt: null,
  sourceUpdatedAt: null,
  dataAsOf: "2026-11-08",
  checkedAt: "2026-11-08",
  validFrom: null,
  validUntil: null,
  termsStatus: "confirmed",
  termsSummary: "테스트에서만 사용하는 가짜 승인 조건",
  termsUrl: "https://example.invalid/test-terms",
  retrievalMethod: "manual_review",
  fields: [
    {
      id: "test-sunday",
      title: "일요일 수거 테스트",
      intent: "collection",
      keywords: ["일요일", "공휴일", "미수거"],
      content: "테스트 전용 근거 문장입니다.",
      validationStatus: "match",
      answerEligible: true,
    },
  ],
};

describe("server search flow", () => {
  it("keeps production generation disabled with missing keys or absent explicit opt-in, without network", async () => {
    const names = ["LLM_SEARCH_ENABLED", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"] as const;
    const saved = names.map((name) => process.env[name]);
    const originalFetch = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = async () => { networkCalls++; throw new Error("network prohibited"); };
    try {
      for (const name of names) delete process.env[name];
      for (const scenario of ["no-config", "key-only", "enabled-without-key"]) {
        if (scenario === "key-only") {
          process.env.LLM_API_KEY = "offline-dummy";
          process.env.LLM_BASE_URL = "https://example.invalid/v1";
          process.env.LLM_MODEL = "offline-dummy";
        }
        if (scenario === "enabled-without-key") {
          process.env.LLM_SEARCH_ENABLED = "true";
          delete process.env.LLM_API_KEY;
        }
        const result = await searchAndAnswer({ question: "성남시 일요일 쓰레기 수거해?", location: "경기도 성남시" }, { sources: [eligibleFixture] });
        assert.equal(result.status, "insufficient", scenario);
        assert.ok(result.sources.length);
      }
      for (const question of ["주민센터 어디야?", "체육시설", "우리 동네 쓰레기 언제 버려?", "공지", "11월 행사"]) {
        const result = await searchAndAnswer({ question, location: "경기도 성남시 중원구 은행1동" });
        assert.notEqual(result.status, "timeout");
      }
      assert.equal(networkCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
      names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; });
    }
  });
  it("uses only matched eligible evidence and returns source IDs", async () => {
    let called = false;
    const result = await searchAndAnswer(
      { question: "성남시 일요일 쓰레기 수거해?", location: "경기도 성남시 분당구 정자동" },
      {
        sources: [eligibleFixture],
        generateAnswer: async (_question, evidence) => {
          called = true;
          assert.equal(evidence[0].id, "test-sunday");
          return "테스트 근거에 따른 답변입니다.";
        },
      },
    );

    assert.equal(result.status, "answered");
    assert.equal(called, true);
    if (result.status === "answered") {
      assert.equal(result.sources[0].id, "test-source");
      assert.deepEqual(result.sources[0].fieldIds, ["test-sunday"]);
    }
  });

  it("does not call the model when the requested region differs", async () => {
    let called = false;
    const result = await searchAndAnswer(
      { question: "일요일 쓰레기 수거해?", location: "서울특별시 마포구 연남동" },
      {
        sources: [eligibleFixture],
        generateAnswer: async () => {
          called = true;
          return "should not run";
        },
      },
    );

    assert.equal(result.status, "region_mismatch");
    assert.equal(called, false);
  });

  it("provides reviewed waste basics while withholding unverified weekdays and model generation", async () => {
    let called = false;
    const result = await searchAndAnswer({
      question: "성남시 쓰레기 배출 요일과 시간은?",
      location: "경기도 성남시 분당구 정자동",
    }, {
      generateAnswer: async () => {
        called = true;
        return "should not run";
      },
    });

    assert.equal(result.status, "waste_results");
    assert.equal(called, false);
    assert.ok(result.sources.some((source) => source.sourceUrl.includes("recycle.seongnam.go.kr")));
  });

  it("does not use a collection fact to answer a disposal question", async () => {
    let called = false;
    const result = await searchAndAnswer(
      { question: "성남시 일요일에 쓰레기 배출해?", location: "경기도 성남시" },
      {
        sources: [eligibleFixture],
        generateAnswer: async () => {
          called = true;
          return "should not run";
        },
      },
    );

    assert.equal(result.status, "insufficient");
    assert.equal(called, false);
  });

  it("uses the selected center for nearby requests without claiming nearest", async () => {
    let called = false;
    const result = await searchAndAnswer({
      question: "가까운 주민센터 어디야?",
      location: "경기도 성남시 중원구 은행1동",
    }, {
      sources: [],
      generateAnswer: async () => {
        called = true;
        return "should not run";
      },
    });

    assert.equal(result.status, "resident_center_results");
    assert.equal(called, false);
    if (result.status === "resident_center_results") {
      assert.equal(result.center.dong, "은행1동");
      assert.match(result.message, /길찾기를 누르면 현재 위치를 출발지로 연결/u);
      assert.match(result.message, /가장 가까운 곳이라고 단정하지 않습니다/u);
    }
  });

  it("does not guess a district for resident-center questions", async () => {
    const result = await searchAndAnswer({
      question: "성남시 주민센터 어디야?",
      location: "경기도 성남시",
    });

    assert.equal(result.status, "insufficient");
    assert.deepEqual(result.sources, []);
    assert.match(result.message, /행정동/u);
  });

  it("does not return resident-center links for another region", async () => {
    const result = await searchAndAnswer({
      question: "서울특별시 주민센터 어디야?",
      location: "서울특별시 마포구",
    });

    assert.equal(result.status, "insufficient");
    assert.deepEqual(result.sources, []);
    assert.match(result.message, /아직 확인하지 못했습니다/u);
  });

  it("provides the official library link only for Seongnam", async () => {
    const seongnamResult = await searchAndAnswer({
      question: "성남시 도서관 목록",
      location: "경기도 성남시",
    });
    const otherRegionResult = await searchAndAnswer({
      question: "서울특별시 도서관 목록",
      location: "서울특별시",
    });

    assert.equal(seongnamResult.status, "link_only");
    assert.equal(seongnamResult.sources[0].category, "library");
    assert.equal(seongnamResult.sources[0].sourceUrl, "https://www.snlib.go.kr/intro/index.do");
    assert.equal(otherRegionResult.status, "insufficient");
    assert.deepEqual(otherRegionResult.sources, []);
  });

  it("returns matching facility records without calling the model", async () => {
    let called = false;
    const result = await searchAndAnswer(
      { question: "성남시청 한누리 회의실", location: "경기도 성남시" },
      {
        generateAnswer: async () => {
          called = true;
          return "should not run";
        },
      },
    );

    assert.equal(result.status, "facility_results");
    assert.equal(called, false);
    if (result.status === "facility_results") {
      assert.equal(result.total, 1);
      assert.equal(result.facilities[0].name, "성남시청 한누리");
      assert.equal(result.facilities[0].facilityType, "회의실");
      assert.equal(result.facilities[0].fee, "");
      assert.equal(result.facilities[0].isPaid, "N");
      assert.equal(result.sources[0].category, "facility");
      assert.equal(result.sources[0].dataAsOf, "2026-08-14");
    }
  });

  it("uses the Seongnam file's address fallback and returns the requested facility page", async () => {
    let called = false;
    const result = await searchAndAnswer(
      { question: "성남시 공공시설", location: "경기도 성남시" },
      {
        generateAnswer: async () => {
          called = true;
          return "should not run";
        },
      },
    );

    assert.equal(result.status, "facility_results");
    assert.equal(called, false);
    if (result.status === "facility_results") {
      assert.equal(result.total, 82);
      assert.equal(result.facilities.length, 6);
      assert.equal(result.page, 1);
      assert.equal(result.pageSize, 6);
      assert.ok(result.facilities.every((facility) => facility.address.length > 0));
      assert.ok(result.facilities.every((facility) => facility.latitude && facility.longitude));
    }
  });

  it("returns distinct facility pages and filters generic sports queries by sports types", async () => {
    const firstPage = await searchAndAnswer({
      question: "성남시 전체 공공시설",
      location: "경기도 성남시",
      page: 1,
    });
    const secondPage = await searchAndAnswer({
      question: "성남시 전체 공공시설",
      location: "경기도 성남시",
      page: 2,
    });
    const sports = await searchAndAnswer({
      question: "체육시설 찾아줘",
      location: "경기도 성남시",
    });

    assert.equal(firstPage.status, "facility_results");
    assert.equal(secondPage.status, "facility_results");
    assert.equal(sports.status, "facility_results");
    if (
      firstPage.status === "facility_results" &&
      secondPage.status === "facility_results" &&
      sports.status === "facility_results"
    ) {
      assert.notEqual(firstPage.facilities[0].id, secondPage.facilities[0].id);
      assert.ok(sports.total > 0 && sports.total < 82);
      assert.ok(sports.facilities.every((facility) =>
        !["회의실", "강당", "강의실"].includes(facility.facilityType),
      ));
    }
  });

  it("does not assign facilities to an administrative dong without verified dong data", async () => {
    let called = false;
    const result = await searchAndAnswer({
      question: "체육시설 찾아줘",
      location: "경기도 성남시 중원구 은행1동",
    }, {
      generateAnswer: async () => {
        called = true;
        return "should not run";
      },
    });

    it("provides all 50 verified Seongnam dong options without inventing codes or coordinates", () => {
      const options = getNeighborhoodOptions();
      assert.equal(options.length, 50);
      assert.equal(new Set(options.map((option) => option.id)).size, 50);
      assert.ok(options.every((option) => option.city === "성남시"));
      assert.ok(options.every((option) => option.administrativeCode === null));
      assert.ok(seongnamCenters.every(
        (center) => center.latitude === null && center.longitude === null,
      ));
      assert.ok(options.some((option) =>
        option.label === "경기도 성남시 중원구 은행1동",
      ));
    });

    it("resolves the selected neighborhood center without claiming it is nearest or jurisdiction-confirmed", async () => {
      const selected = resolveResidentCenter(
        "우리 동 주민센터 어디야?",
        "경기도 성남시 중원구 은행1동",
      );
      assert.equal(selected.center?.dong, "은행1동");
      assert.equal(selected.explicitDong, false);

      const result = await searchAndAnswer({
        question: "우리 동 주민센터 어디야?",
        location: "경기도 성남시 중원구 은행1동",
      });
      assert.equal(result.status, "resident_center_results");
      if (result.status === "resident_center_results") {
        assert.equal(result.center.centerName, "은행1동행정복지센터");
        assert.equal(result.center.latitude, null);
        assert.equal(result.center.longitude, null);
        assert.equal(result.center.administrativeCode, null);
      }
    });

    it("resolves an explicitly named dong and keeps district context", () => {
      const resolved = resolveResidentCenter(
        "은행1동 주민센터 어디야?",
        "경기도 성남시",
      );
      assert.equal(resolved.center?.district, "중원구");
      assert.equal(resolved.center?.dong, "은행1동");
      assert.equal(resolved.explicitDong, true);

      const wrongDistrict = resolveResidentCenter(
        "수정구 은행1동 주민센터",
        "경기도 성남시",
      );
      assert.equal(wrongDistrict.center, null);
      assert.equal(wrongDistrict.explicitDong, true);

      const explicitQuestionOverridesSelectedDong = resolveResidentCenter(
        "은행1동 주민센터 어디야?",
        "경기도 성남시 수정구 신흥1동",
      );
      assert.equal(explicitQuestionOverridesSelectedDong.center?.district, "중원구");
      assert.equal(explicitQuestionOverridesSelectedDong.center?.dong, "은행1동");
    });

    assert.equal(result.status, "insufficient");
    assert.match(result.message, /행정동 구분값이 없어/u);
    assert.equal(called, false);
  });

  it("handles natural-language facility search wording", async () => {
    const result = await searchAndAnswer({
      question: "이번 주 성남시 회의실 찾아줘",
      location: "경기도 성남시",
    });

    assert.equal(result.status, "facility_results");
    if (result.status === "facility_results") {
      assert.equal(result.total, 17);
      assert.ok(result.facilities.every((facility) => facility.facilityType === "회의실"));
    }
  });

  it("returns manually checked notice metadata without calling the model", async () => {
    let called = false;
    const result = await searchAndAnswer(
      { question: "성남시 주요 공지 알려줘", location: "경기도 성남시" },
      {
        generateAnswer: async () => {
          called = true;
          return "should not run";
        },
      },
    );

    assert.equal(result.status, "notice_results");
    assert.equal(called, false);
    if (result.status === "notice_results") {
      assert.match(result.message, /실시간 전체 목록은 아닙니다/u);
      assert.equal(result.notices.length, 3);
      assert.equal(result.sources[0].category, "notice");
      assert.equal(result.sources[0].sourceUrl, "https://www.seongnam.go.kr/bbs010101/405886");
    }
  });

  it("returns checked event and recruitment dates for a selected dong without calling the model", async () => {
    let called = false;
    const result = await searchAndAnswer(
      { question: "이번 주 동네 행사·모집 있어?", location: "경기도 성남시 중원구 은행1동" },
      {
        today: "2026-11-08",
        generateAnswer: async () => {
          called = true;
          return "should not run";
        },
      },
    );

    assert.equal(result.status, "event_results");
    assert.equal(called, false);
    if (result.status === "event_results") {
      assert.equal(result.sources[0].category, "event");
      assert.equal(result.events.length, 1);
      assert.equal(result.events[0].eventDate, "2026-11-23");
      assert.equal(result.events[0].applicationEndsOn, "2026-11-20");
      assert.match(result.message, /신청기간/u);
      assert.match(result.message, /이번 주 개최일은 없지만/u);
    }
  });

  it("does not offer Seongnam notice or facility records for another region", async () => {
    const eventResult = await searchAndAnswer({
      question: "서울특별시 행사 있어?",
      location: "서울특별시 마포구 연남동",
    });
    const facilityResult = await searchAndAnswer({
      question: "서울특별시 공공시설",
      location: "서울특별시 마포구 연남동",
    });

    assert.equal(eventResult.status, "insufficient");
    assert.ok(eventResult.sources.every((source) => !source.sourceUrl.includes("seongnam.go.kr")));
    assert.equal(facilityResult.status, "region_mismatch");
    assert.ok(facilityResult.sources.every((source) => source.category === "facility"));
  });

  it("does not substitute facilities for a resident-center question", async () => {
    const result = await searchAndAnswer({
      question: "성남시 주민센터 어디야?",
      location: "경기도 성남시",
    });

    assert.equal(result.status, "insufficient");
    assert.deepEqual(result.sources, []);
  });

  it("returns a bounded timeout without exposing provider errors", async () => {
    const result = await searchAndAnswer(
      { question: "성남시 일요일 쓰레기 수거해?", location: "경기도 성남시" },
      {
        sources: [eligibleFixture],
        timeoutMs: 10,
        generateAnswer: () => new Promise<string>(() => undefined),
      },
    );

    assert.equal(result.status, "timeout");
  });

  it("enforces the request frequency window", () => {
    const allow = createSearchRateLimiter(2, 1_000);
    assert.equal(allow(0), true);
    assert.equal(allow(500), true);
    assert.equal(allow(999), false);
    assert.equal(allow(1_000), true);
  });
});

describe("calendar and map helpers", () => {
  it("calculates dates in Korean time and Monday-based calendar ranges", () => {
    assert.equal(getKoreanDateKey(new Date("2026-01-01T15:30:00Z")), "2026-01-02");
    assert.deepEqual(getWeekDateKeys("2026-11-08"), [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    assert.equal(getMonthDateKeys("2026-11").length, 42);
  });

  it("keeps schedule date labels distinct and creates validated Naver links", () => {
    const schedule = {
      id: "official-event",
      title: "공식 일정",
      regionName: "성남시",
      eventDate: "2026-11-10",
      applicationStartsOn: "2026-11-01",
      applicationEndsOn: "2026-11-12",
      closingDate: "2026-11-12",
      sourceName: "성남시",
      sourceUrl: "https://www.seongnam.go.kr/",
      checkedAt: "2026-11-08",
    };
    assert.deepEqual(getScheduleLabelsForDate(schedule, "2026-11-10"), ["행사일"]);
    assert.deepEqual(getScheduleLabelsForDate(schedule, "2026-11-12"), []);

    const destination = {
      name: "공공시설",
      address: "경기도 성남시",
      latitude: "37.44",
      longitude: "127.13",
    };
    const appRoute = getNaverMapRouteUrl(destination, "https://example.test");
    assert.ok(appRoute);
    assert.match(appRoute, /^nmap:\/\/route\/public\?/u);
    const appRouteUrl = new URL(appRoute);
    assert.equal(appRouteUrl.searchParams.get("dlat"), "37.44");
    assert.equal(appRouteUrl.searchParams.get("dlng"), "127.13");
    assert.equal(appRouteUrl.searchParams.get("appname"), "https://example.test");
    assert.equal(appRouteUrl.searchParams.get("dname"), "공공시설 (경기도 성남시)");
    assert.equal(getNaverMapRouteUrl({ ...destination, latitude: "" }, "https://example.test"), null);
    assert.equal(getNaverMapRouteUrl({ ...destination, address: "" }, "https://example.test"), null);
  });
});
