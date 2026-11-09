import "server-only";
import { formatWasteAnswer, getWasteGuidance, isWasteGuideQuestion, parseWasteQuestion, WASTE_PORTAL_URL, WASTE_CHECKED_AT } from "../waste-guide";
import { searchOfficialNotices } from "../official-notices";
import { filterEventsByLocation, getEventDates, officialEvents, searchOfficialEvents } from "../official-events";
import { getKoreanDateKey, getWeekDateKeys } from "../calendar";

import { getLlmClient, getLlmModel } from "./llm";
import { buildAnswerRequest, readAnswerCompletion, type AnswerEvidence } from "./answer-generation";
import facilityData from "./seongnam-facilities.json";
import {
  getCenterSource,
  resolveResidentCenter,
} from "./seongnam-centers";
import type {
  FacilitySearchRecord,
  ResidentCenterSearchRecord,
  SearchCategory,
  SearchCitation,
  SearchResult,
} from "../search-types";

const SEONGNAM_GUIDE_URL =
  "https://recycle.seongnam.go.kr/platforminfo/trash";
const SEONGNAM_TERMS_URL =
  "https://recycle.seongnam.go.kr/guide/copyright";
const WASTE_API_URL = "https://www.data.go.kr/data/15155080/openapi.do";
const SEARCH_TIMEOUT_MS = 15_000;
const MAX_ANSWER_LENGTH = 2_000;

type ValidationStatus =
  | "match"
  | "conditional_difference"
  | "unverifiable"
  | "unknown";

type SearchIntent = "collection" | "disposal" | "area" | "holiday" | "bulk";

type EvidenceField = {
  id: string;
  title: string;
  intent: SearchIntent;
  keywords: string[];
  content: string;
  validationStatus: ValidationStatus;
  answerEligible: boolean;
};

export type EvidenceSource = {
  id: string;
  category: SearchCategory;
  title: string;
  sourceName: string;
  sourceUrl: string;
  regionName: string;
  regionLevel: "national" | "city";
  managementArea: string | null;
  publishedAt: string | null;
  sourceUpdatedAt: string | null;
  dataAsOf: string | null;
  checkedAt: string;
  validFrom: string | null;
  validUntil: string | null;
  termsStatus: "confirmed" | "unresolved";
  termsSummary: string;
  termsUrl: string;
  retrievalMethod: "manual_review" | "public_api" | "downloaded_file";
  fields: EvidenceField[];
};

type FacilityRecord = FacilitySearchRecord & {
  lotAddress: string;
  usageHours: string;
  dataAsOf: string;
};

const FACILITY_PAGE_SIZE = 6;

const facilityRecords: FacilityRecord[] = facilityData.map((record) => ({
  id: record.id,
  name: record.name,
  place: record.place,
  facilityType: record.type,
  address: record.address || record.lotAddress,
  lotAddress: record.lotAddress,
  closedDays: record.closedDays,
  weekdayHours: formatHours(record.weekdayStart, record.weekdayEnd),
  weekendHours: formatHours(record.weekendStart, record.weekendEnd),
  isPaid: record.isPaid,
  fee: record.fee,
  capacity: record.capacity,
  amenities: record.amenities,
  applicationMethod: record.applicationMethod,
  latitude: record.latitude,
  longitude: record.longitude,
  administrativeDongName: null,
  usageHours: record.usageHours,
  dataAsOf: record.dataAsOf,
}));

function formatHours(start: string, end: string): string {
  if (!start && !end) return "";
  return `${start || "정보 없음"}–${end || "정보 없음"}`;
}

const facilitySource: EvidenceSource = {
  id: "seongnam-public-facilities",
  category: "facility",
  title: "경기도 성남시 공공시설개방정보",
  sourceName: "공공데이터포털 · 경기도 성남시",
  sourceUrl: "https://www.data.go.kr/data/15013117/standard.do",
  regionName: "경기도 성남시",
  regionLevel: "city",
  managementArea: null,
  publishedAt: null,
  sourceUpdatedAt: "2026-08-28",
  dataAsOf: "2026-08-14",
  checkedAt: "2026-11-08",
  validFrom: null,
  validUntil: null,
  termsStatus: "confirmed",
  termsSummary: "무료 CSV 파일의 이용허락범위가 제한 없음으로 표시됨.",
  termsUrl: "https://www.data.go.kr/ugs/selectPortalPolicyView.do",
  retrievalMethod: "downloaded_file",
  fields: [],
};

const evidenceSources: EvidenceSource[] = [
  {
    id: "seongnam-waste-guidance",
    category: "waste",
    title: "생활 쓰레기 분리배출 안내",
    sourceName: "성남시 자원순환 통합 플랫폼",
    sourceUrl: SEONGNAM_GUIDE_URL,
    regionName: "경기도 성남시",
    regionLevel: "city",
    managementArea: null,
    publishedAt: null,
    sourceUpdatedAt: null,
    dataAsOf: null,
    checkedAt: "2026-11-08",
    validFrom: null,
    validUntil: null,
    termsStatus: "unresolved",
    termsSummary: "웹페이지 재사용 조건 미확인. 링크 안내만 허용하며 답변 근거로 사용하지 않음.",
    termsUrl: SEONGNAM_TERMS_URL,
    retrievalMethod: "manual_review",
    fields: [
      {
        id: "seongnam-page-disposal-guidance",
        title: "공식 페이지의 배출·수거 안내",
        intent: "disposal",
        keywords: ["배출", "버리", "요일", "시간"],
        content: "",
        validationStatus: "unknown",
        answerEligible: false,
      },
    ],
  },
  {
    id: "mois-waste-api-seongnam",
    category: "waste",
    title: "생활쓰레기배출정보 조회서비스 — 경기 성남시",
    sourceName: "행정안전부 공공데이터 API",
    sourceUrl: WASTE_API_URL,
    regionName: "경기도 성남시",
    regionLevel: "city",
    managementArea: null,
    publishedAt: null,
    sourceUpdatedAt: null,
    dataAsOf: "2022-11-25",
    checkedAt: "2026-11-08",
    validFrom: null,
    validUntil: null,
    termsStatus: "confirmed",
    termsSummary: "공공데이터포털 상세 페이지에 무료·이용허락범위 제한 없음으로 표시됨.",
    termsUrl: WASTE_API_URL,
    retrievalMethod: "public_api",
    fields: [
      {
        id: "non-collection-sunday-holidays",
        title: "일요일·공휴일 미수거",
        intent: "collection",
        keywords: ["일요일", "공휴일", "미수거"],
        content: "성남시 단위 안내에서 일요일과 공휴일은 수거하지 않는 것으로 확인됐습니다.",
        validationStatus: "match",
        answerEligible: true,
      },
      {
        id: "disposal-days-and-times",
        title: "폐기물별 배출 요일·시간",
        intent: "disposal",
        keywords: ["배출", "버리", "요일", "시간"],
        content: "",
        validationStatus: "conditional_difference",
        answerEligible: false,
      },
      {
        id: "saturday-collection",
        title: "토요일 수거",
        intent: "collection",
        keywords: ["토요일"],
        content: "",
        validationStatus: "conditional_difference",
        answerEligible: false,
      },
      {
        id: "management-area-and-method",
        title: "세부 관리구역·거점 및 문전 배출 방식",
        intent: "area",
        keywords: ["동별", "거점", "문전", "관리구역"],
        content: "",
        validationStatus: "unverifiable",
        answerEligible: false,
      },
      {
        id: "year-specific-holiday-schedule",
        title: "연도별 설날·추석 수거 일정",
        intent: "holiday",
        keywords: ["설날", "추석", "명절", "2026"],
        content: "",
        validationStatus: "unverifiable",
        answerEligible: false,
      },
      {
        id: "temporary-bulk-waste",
        title: "일시적 다량폐기물 분류·배출",
        intent: "bulk",
        keywords: ["일시적 다량폐기물", "대량폐기물", "대형폐기물"],
        content: "",
        validationStatus: "unverifiable",
        answerEligible: false,
      },
    ],
  },
];

export type SearchInput = {
  question: string;
  location: string;
  page?: number;
};

type GenerateAnswer = (
  question: string,
  fields: AnswerEvidence[],
  signal: AbortSignal,
) => Promise<string>;

type SearchDependencies = {
  staticOnly?: boolean;
  today?: string;
  sources?: readonly EvidenceSource[];
  generateAnswer?: GenerateAnswer;
  timeoutMs?: number;
};

const knownRegions = [
  { name: "경기도 성남시", aliases: ["경기도 성남시", "성남시", "성남"] },
  { name: "서울특별시", aliases: ["서울특별시", "서울"] },
  { name: "부산광역시", aliases: ["부산광역시", "부산"] },
];

function requestedRegion(question: string, selectedLocation: string): string {
  if (/(?:수정구|중원구|분당구)/u.test(question)) return "경기도 성남시";
  const regionQuestion = question.replace(/서울공항/gu, "");
  const explicit = knownRegions.find((region) =>
    region.aliases.some((alias) => regionQuestion.includes(alias)),
  );
  if (explicit) return explicit.name;
  const explicitAdministrativeArea = question.match(
    /(?:[가-힣]+(?:특별시|광역시|도)\s*)?[가-힣]{2,}(?:시|군)(?=\s|$|[?!.])/u,
  );
  const explicitProvince = question.match(/[가-힣]+(?:특별자치도|도)(?=\s|$|[?!.])/u);
  return explicitAdministrativeArea?.[0].trim() ?? explicitProvince?.[0] ?? selectedLocation;
}

function matchesRegion(source: EvidenceSource, region: string): boolean {
  const sourceCity = source.regionName.split(/\s+/).at(-1);
  return region.includes(source.regionName) || Boolean(sourceCity && region.includes(sourceCity));
}

function matchingFields(source: EvidenceSource, question: string): EvidenceField[] {
  const intentPattern: Record<SearchIntent, RegExp> = {
    collection: /수거|미수거|가져가|청소차/u,
    disposal: /배출|버리|내놓/u,
    area: /동별|관리구역|거점|문전|배출장소/u,
    holiday: /설날|추석|명절|2026/u,
    bulk: /일시적\s*다량폐기물|대량폐기물|대형폐기물/u,
  };
  return source.fields.filter((field) =>
    intentPattern[field.intent].test(question) &&
    field.keywords.some((keyword) => question.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())),
  );
}

function isEligible(source: EvidenceSource, field: EvidenceField): boolean {
  return (
    source.termsStatus === "confirmed" &&
    field.answerEligible &&
    field.validationStatus === "match" &&
    field.content.trim().length > 0
  );
}

function citationFor(source: EvidenceSource, fields: EvidenceField[]): SearchCitation {
  return {
    id: source.id,
    category: source.category,
    title: source.title,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    regionName: source.regionName,
    regionLevel: source.regionLevel,
    dataAsOf: source.dataAsOf,
    checkedAt: source.checkedAt,
    fieldIds: fields.map((field) => field.id),
  };
}

function directoryCitation(
  id: string,
  category: SearchCategory,
  title: string,
  sourceName: string,
  sourceUrl: string,
  regionName: string,
): SearchCitation {
  return {
    id,
    category,
    title,
    sourceName,
    sourceUrl,
    regionName,
    regionLevel: "city",
    dataAsOf: null,
    checkedAt: "2026-11-08",
    fieldIds: [],
  };
}

function isWasteQuestion(question: string): boolean {
  return /쓰레기|폐기물|배출|분리배출|재활용|음식물|수거|미수거/u.test(question);
}

function isReviewedCollectionQuestion(question: string): boolean {
  if (!/일요일|공휴일|미수거/u.test(question) || !/수거|가져가|청소차/u.test(question)) return false;
  const remainder = question.replace(/일요일|공휴일/gu, "");
  return !/배출|버리|버려|버릴|내놓|오늘|내일|어제|이번|다음|지난|올해|명절|설날|추석|토요일|평일|주말|요일|시간|몇\s*시|언제|관리구역|관할|아파트|공동주택|단독|상가|음식물|재활용|분리|종이|플라스틱|페트|유리|비닐|사업장|건설|산업|의료|병원|약품|화학|유해|방사|농약|석면|다량|대형|\d/u.test(remainder);
}

function directoryIntent(
  question: string,
): "notice" | "event" | "resident_center" | "library" | "facility" | null {
  if (/행사|모집|프로그램|강좌|공연|축제|예약/u.test(question)) return "event";
  if (/공지|공고|시정소식|알림|야간비행|서울공항|마인드피트니스|노후계획도시/u.test(question)) return "notice";
  if (/주민센터|행정복지센터|동사무소/u.test(question)) return "resident_center";
  if (/도서관|열람실|자료실/u.test(question)) return "library";
  if (/공공시설|시설|주민센터|체육관|회의실|강당|강의실|운동장|농구장|축구장|야구장|테니스장|풋살|대관/u.test(question)) {
    return "facility";
  }
  return null;
}

function directoryLink(category: "notice" | "event", region: string): SearchCitation {
  const isEvent = category === "event";
  return directoryCitation(
    isEvent ? "seongnam-official-reservations" : "seongnam-official-notices",
    category,
    isEvent ? "성남시 통합예약 · 공식 행사·모집·프로그램" : "성남시 시정소식·공지사항",
    "성남시",
    isEvent
      ? "https://www.seongnam.go.kr/apply/index"
      : "https://www.seongnam.go.kr/bbs010101",
    region,
  );
}

function facilityCitation(): SearchCitation {
  return citationFor(facilitySource, []);
}

function centerCitation(
  center: ResidentCenterSearchRecord,
  sourceId: string,
): SearchCitation {
  const source = getCenterSource(sourceId);
  return {
    id: source.id,
    category: "resident_center",
    title: source.title,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    regionName: `경기도 성남시 ${center.district} ${center.dong}`,
    regionLevel: "dong",
    dataAsOf: center.dataAsOf,
    checkedAt: source.checkedAt,
    fieldIds: ["center-name", "address", "phone"],
  };
}

function searchFacilityRecords(question: string, location: string, page: number): {
  total: number;
  results: FacilitySearchRecord[];
  page: number;
  pageSize: number;
  regionDong: string | null;
} {
  const typeMatchers = [
    { type: "회의실", pattern: /회의실|회의/u },
    { type: "강당", pattern: /강당/u },
    { type: "강의실", pattern: /강의실|강의/u },
    { type: "체육관", pattern: /체육관/u },
    { type: "농구장", pattern: /농구/u },
    { type: "배드맨턴장", pattern: /배드민턴|배드맨턴/u },
    { type: "축구장", pattern: /축구/u },
    { type: "야구장", pattern: /야구/u },
    { type: "테니스장", pattern: /테니스/u },
    { type: "족구장", pattern: /족구/u },
    { type: "풋살경기장", pattern: /풋살/u },
    { type: "다목적경기장", pattern: /다목적경기장/u },
    { type: "__sports__", pattern: /체육시설|운동시설/u },
  ];
  const requestedTypes = typeMatchers
    .filter(({ pattern }) => pattern.test(question))
    .map(({ type }) => type)
    .filter((type) => type !== "__sports__");
  if (/체육시설|운동시설/u.test(question)) {
    requestedTypes.push(
      "체육관",
      "농구장",
      "배드맨턴장",
      "야구장",
      "족구장",
      "축구장",
      "테니스장",
      "풋살경기장",
      "다목적경기장",
    );
  }
  const ignoredTerms = new Set([
    "이번",
    "이번주",
    "주",
    "오늘",
    "내일",
    "주말",
    "평일",
    "가능",
    "예약",
    "대관",
    "이용",
    "정보",
    "검색",
    "찾아줘",
    "알려줘",
    "있나요",
    "있어",
    "전체",
    "체육시설",
    "운동시설",
  ]);
  const terms = (question.match(/[가-힣A-Za-z0-9]+/gu) ?? []).filter(
    (term) =>
      term.length > 1 &&
      !ignoredTerms.has(term) &&
      !/성남시?|경기도|공공시설|시설|가까운|주변|우리|동네|어디|알려|찾아|주세요|있어|뭐/u.test(term),
  );
  const searchTerms = terms.filter(
    (term) => !typeMatchers.some(({ pattern }) => pattern.test(term)),
  );

  const explicitDong = question.match(/([가-힣0-9]{2,}동)(?![가-힣])/u)?.[1];
  const selectedDong = /(?:성남시\s*전체|전체\s*성남시|시\s*전체|성남\s*전역)/u.test(question)
    ? null
    : explicitDong ?? location.match(/[가-힣0-9]{2,}동/u)?.[0] ?? null;
  const matched = facilityRecords
    .filter((record) => {
      if (selectedDong && record.administrativeDongName !== selectedDong) {
        return false;
      }
      if (
        requestedTypes.length > 0 &&
        !requestedTypes.some((type) => record.facilityType.includes(type))
      ) {
        return false;
      }
      if (searchTerms.length === 0) return true;
      const searchable = [
        record.name,
        record.place,
        record.facilityType,
        record.address,
        record.lotAddress,
      ].join(" ").toLocaleLowerCase();
      return searchTerms.every((term) => searchable.includes(term.toLocaleLowerCase()));
    });

  return {
    total: matched.length,
    results: matched
      .slice((page - 1) * FACILITY_PAGE_SIZE, page * FACILITY_PAGE_SIZE)
      .map(({ lotAddress: _lotAddress, usageHours: _usageHours, dataAsOf: _dataAsOf, ...record }) => record),
    page,
    pageSize: FACILITY_PAGE_SIZE,
    regionDong: selectedDong,
  };
}

function officialFallbackSources(region: string, relevant: EvidenceSource[]): SearchCitation[] {
  if (!isWasteQuestion(relevant.map((source) => source.title).join(" ")) && relevant.length === 0) {
    if (region.includes("성남")) {
      return [{
        id: "seongnam-government-home",
        category: "general",
        title: "성남시 공식 홈페이지",
        sourceName: "성남시",
        sourceUrl: "https://www.seongnam.go.kr/",
        regionName: "경기도 성남시",
        regionLevel: "city",
        dataAsOf: null,
        checkedAt: "2026-11-08",
        fieldIds: [],
      }];
    }
    return [{
      id: "government24-home",
      category: "general",
      title: "정부24 공식 홈페이지",
      sourceName: "정부24",
      sourceUrl: "https://www.gov.kr/",
      regionName: "전국",
      regionLevel: "national",
      dataAsOf: null,
      checkedAt: "2026-11-08",
      fieldIds: [],
    }];
  }

  if (region.includes("성남")) {
    const page = evidenceSources.find((source) => source.id === "seongnam-waste-guidance");
    const api = evidenceSources.find((source) => source.id === "mois-waste-api-seongnam");
    return [page, api]
      .filter((source): source is EvidenceSource => Boolean(source))
      .map((source) => {
        const matched = relevant.find((item) => item.id === source.id);
        return citationFor(source, matched?.fields ?? []);
      });
  }

  return [
    {
      id: "mois-waste-api-details",
      category: "waste",
      title: "전국 생활쓰레기배출정보 API 공식 안내",
      sourceName: "공공데이터포털",
      sourceUrl: WASTE_API_URL,
      regionName: "전국 자료 제공 안내",
      regionLevel: "national",
      dataAsOf: null,
      checkedAt: "2026-11-08",
      fieldIds: [],
    },
  ];
}

async function generateWithLlm(
  question: string,
  fields: Parameters<GenerateAnswer>[1],
  signal: AbortSignal,
): Promise<string> {
  const request = buildAnswerRequest(question, fields, getLlmModel());
  const client = getLlmClient();
  const completion = await client.chat.completions.create(
    request,
    { signal, maxRetries: 0, timeout: SEARCH_TIMEOUT_MS },
  );
  return readAnswerCompletion(completion);
}

async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("SEARCH_TIMEOUT"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work(controller.signal), timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function searchAndAnswer(
  input: SearchInput,
  dependencies: SearchDependencies = {},
): Promise<SearchResult> {
  const sources = dependencies.sources ?? evidenceSources;
  const region = requestedRegion(input.question, input.location);
  const reviewedCollection = !dependencies.sources && isReviewedCollectionQuestion(input.question);
  if (!dependencies.sources && !reviewedCollection && isWasteGuideQuestion(input.question)) {
    if (!region.includes("성남")) return {
      status: "region_mismatch", message: "현재 확인한 배출 안내책자는 성남시 자료입니다. 해당 지자체의 공식 배출 안내를 확인해 주세요.", sources: [],
    };
    const resolved = resolveResidentCenter(input.question, input.location);
    if (resolved.explicitDong && !resolved.center) return {
      status: "insufficient", message: "질문의 행정동을 확인하지 못했어요. 구와 동을 함께 선택하거나 입력해 주세요.", sources: [],
    };
    const explicitDistrict = input.question.match(/수정구|중원구|분당구/u)?.[0];
    const targetRegion = /성남(?:시)?\s*전체/u.test(input.question) ? "경기도 성남시"
      : resolved.explicitDong && resolved.center ? `경기도 성남시 ${resolved.center.district} ${resolved.center.dong}`
      : explicitDistrict ? `경기도 성남시 ${explicitDistrict}` : input.location.includes("성남시") ? input.location : region;
    const { category, housing } = parseWasteQuestion(input.question);
    const guide = getWasteGuidance(targetRegion, category, housing);
    if (guide) return {
      status: "waste_results", regionName: targetRegion, category, housing,
      answer: formatWasteAnswer(guide),
      message: "공식 안내책자와 배출 안내를 대조해 정리한 기본 방법입니다. 주택 유형별 조건을 확인해 주세요. 요일·주말 안내는 문서별 차이가 있어 상세 배출일을 단정하지 않습니다.",
      sources: [{ id: "seongnam-waste-booklet", category: "waste", title: "공식 생활폐기물 배출 안내", sourceName: "성남시 자원순환", sourceUrl: WASTE_PORTAL_URL, regionName: "경기도 성남시", regionLevel: "city", dataAsOf: null, checkedAt: WASTE_CHECKED_AT, fieldIds: [category] }],
    };
  }
  if (!isWasteQuestion(input.question)) {
    const intent = directoryIntent(input.question);
    if (intent === "resident_center") {
      if (!region.includes("성남")) {
        return {
          status: "insufficient",
          message: `현재 확보한 행정복지센터 자료는 성남시뿐이에요. ${region}의 센터 정보는 아직 확인하지 못했습니다.`,
          sources: [],
        };
      }
      const { center, ambiguous, explicitDong } = resolveResidentCenter(
        input.question,
        input.location,
      );
      if (!center) {
        return {
          status: "insufficient",
          message: ambiguous
            ? "같은 이름의 행정동이 있어 구를 함께 선택해 주세요."
            : explicitDong
              ? "요청한 행정동의 센터 자료를 찾지 못했어요. 구와 동을 다시 확인해 주세요."
              : /관할/u.test(input.question)
                ? "거주 주소의 관할은 확인하지 않았어요. 거주 행정동을 선택한 뒤 해당 동 센터를 확인해 주세요."
                : "행정복지센터를 찾으려면 상단에서 성남시의 행정동을 먼저 선택해 주세요.",
          sources: [],
        };
      }
      const record: ResidentCenterSearchRecord = {
        id: center.id,
        administrativeCode: center.administrativeCode,
        district: center.district,
        dong: center.dong,
        centerName: center.centerName,
        postalCode: center.postalCode,
        address: center.address,
        phone: center.phone,
        latitude: center.latitude,
        longitude: center.longitude,
        dataAsOf: center.dataAsOf,
      };
      const isNearbyQuestion = /가까운|근처/u.test(input.question);
      const isJurisdictionQuestion = /관할/u.test(input.question);
      return {
        status: "resident_center_results",
        message: isNearbyQuestion
          ? `${center.dong} 행정복지센터를 안내합니다. 센터 위치 확인 후 길찾기를 누르면 현재 위치를 출발지로 연결할 수 있어요. 전체 센터와의 거리는 비교하지 않아 가장 가까운 곳이라고 단정하지 않습니다.`
          : isJurisdictionQuestion && !explicitDong
            ? `${center.dong} 행정복지센터 정보입니다. 선택한 동을 기준으로 한 안내이며 거주 주소의 관할을 확정한 것은 아닙니다.`
            : `${center.dong} 행정복지센터의 주소와 연락처입니다.`,
        center: record,
        sources: [centerCitation(record, center.sourceId)],
      };
    }

    if (intent === "library") {
      if (!region.includes("성남")) {
        return {
          status: "insufficient",
          message: `현재 확인된 도서관 안내는 성남시 자료뿐이에요. ${region}의 관련 정보를 확보하지 못했습니다.`,
          sources: [],
        };
      }
      return {
        status: "link_only",
        message:
          "성남시립도서관 누리집의 도서관 목록·운영 안내 링크입니다. 도서관 자료를 동네일 검색 결과로 수집하거나 요약하지 않았습니다.",
        sources: [
          directoryCitation(
            "seongnam-public-libraries",
            "library",
            "성남시립도서관 · 도서관 안내",
            "성남시립도서관",
            "https://www.snlib.go.kr/intro/index.do",
            "경기도 성남시",
          ),
        ],
      };
    }

    if (intent === "notice" || intent === "event") {
      if (!region.includes("성남")) {
        return {
          status: "insufficient",
          message: `현재 확인된 공식 ${intent === "event" ? "행사·모집" : "공지"} 링크는 성남시 자료뿐이에요. ${region}의 게시물은 수집하거나 검색하지 않았습니다.`,
          sources: officialFallbackSources(region, []),
        };
      }
      if (intent === "event") {
        const explicitEventDistrict = input.question.match(/수정구|중원구|분당구/u)?.[0];
        const eventLocation = explicitEventDistrict ? `경기도 성남시 ${explicitEventDistrict}`
          : /성남(?:시)?\s*전체/u.test(input.question) ? "경기도 성남시" : input.location;
        const events = searchOfficialEvents(input.question, dependencies.today, filterEventsByLocation(officialEvents, eventLocation));
        const week = /이번\s*주/u.test(input.question) ? getWeekDateKeys(dependencies.today ?? getKoreanDateKey()) : null;
        const recruitmentOnly = week && !events.some((event) => getEventDates(event).some((date) => week.includes(date)));
        if (events.length) return {
          status: "event_results",
          message: `${recruitmentOnly ? "확인한 자료에 이번 주 개최일은 없지만, 이번 주 신청기간에 해당하는 모집 안내가 있어요. " : ""}확인한 성남시 행사·모집 중 질문 기간의 행사일 또는 명시된 신청기간이 겹치는 항목입니다. 개최 장소와 참가 대상을 구분해 확인해 주세요. 선택한 동의 행사만을 뜻하지 않으며 전체 행사 목록은 아닙니다.`,
          events,
          sources: events.map((event) => ({
            id: event.id, category: "event", title: event.title, sourceName: event.sourceName,
            sourceUrl: event.sourceUrl, regionName: "경기도 성남시", regionLevel: "city",
            dataAsOf: null, checkedAt: event.checkedAt, fieldIds: [],
          })),
        };
        return {
          status: "link_only",
          message: "확인한 일정 중 질문 기간에 해당하는 행사·모집을 찾지 못했어요. 실제 행사가 없다는 뜻은 아니며, 최신 전체 목록은 공식 사이트에서 확인해 주세요.",
          sources: [directoryLink("event", "경기도 성남시")],
        };
      }
      const notices = searchOfficialNotices(input.question);
      return {
        status: "notice_results",
        message: "수동 확인한 성남시 공지의 제목·게시일·담당부서입니다. 선택한 동에만 적용되는 공지가 아니며, 본문·현재 유효 여부는 공식 상세 안내에서 확인해 주세요. 실시간 전체 목록은 아닙니다.",
        notices,
        sources: notices.map((notice) => ({
          id: notice.id, category: "notice", title: notice.title, sourceName: "성남시", sourceUrl: notice.sourceUrl,
          regionName: "성남시 공식 게시물", regionLevel: "city", dataAsOf: null, checkedAt: notice.checkedAt, fieldIds: [],
        })),
      };
    }

    if (intent === "facility") {
      if (!matchesRegion(facilitySource, region)) {
        return {
          status: "region_mismatch",
          message: `현재 시설 자료는 ${facilitySource.regionName}에 적용됩니다. ${region}에 적용되는 시설 자료는 확인되지 않았어요.`,
          sources: [facilityCitation()],
        };
      }
      const requestedPage = Number.isSafeInteger(input.page) && (input.page ?? 0) > 0
        ? Math.min(input.page ?? 1, 100)
        : 1;
      const { total, results: facilities, page, pageSize, regionDong } =
        searchFacilityRecords(input.question, input.location, requestedPage);
      if (total === 0) {
        return {
          status: "insufficient",
          message: regionDong
            ? "현재 확보한 자료에서 찾지 못했어요. 시설 자료에 행정동 구분값이 없어 해당 동에 시설을 임의로 배정하지 않았어요."
            : "현재 확보한 자료에서 찾지 못했어요.",
          sources: [facilityCitation()],
        };
      }
      return {
        status: "facility_results",
        message: `${regionDong ? `${regionDong}에 공식적으로 배정된 ` : "성남시 "}공공시설 자료에서 찾은 결과입니다. 거리순 정렬이 아니며 운영 정보는 시설별 공식 안내를 다시 확인해 주세요.`,
        total,
        page,
        pageSize,
        facilities,
        sources: [facilityCitation()],
      };
    }
  }

  const matchedSources = sources
    .map((source) => ({ source, fields: matchingFields(source, input.question) }))
    .filter((entry) => entry.fields.length > 0);

  const inRegion = matchedSources.filter((entry) => matchesRegion(entry.source, region));
  if (inRegion.length === 0) {
    const hasOtherRegionMatch = matchedSources.some((entry) => entry.fields.length > 0);
    if (hasOtherRegionMatch) {
      return {
        status: "region_mismatch",
        message: `현재 확인된 자료는 ${matchedSources[0].source.regionName}에 적용됩니다. ${region}에 적용되는 공식 자료는 확인되지 않았어요.`,
        sources: officialFallbackSources(
          region,
          isWasteQuestion(input.question) ? [evidenceSources[1]] : [],
        ),
      };
    }
    return {
      status: "insufficient",
      message: "질문에 답할 수 있는 검증된 자료를 찾지 못했어요. 공식 링크에서 지역 정보를 확인해 주세요.",
      sources: officialFallbackSources(
        region,
        isWasteQuestion(input.question) ? [evidenceSources[1]] : [],
      ),
    };
  }

  const usable = inRegion.flatMap(({ source, fields }) =>
    fields.filter((field) => isEligible(source, field)).map((field) => ({ source, field })),
  );
  if (usable.length === 0) {
    const fallback = officialFallbackSources(region, inRegion.map(({ source }) => source));
    return {
      status: "insufficient",
      message:
        "현재 질문과 관련된 자료는 있지만 이용조건 또는 항목별 검증 상태 때문에 답변 근거로 사용할 수 없어요. 공식 안내를 직접 확인해 주세요.",
      sources: fallback,
    };
  }

  const citations = usable.reduce<SearchCitation[]>((result, item) => {
    const existing = result.find((citation) => citation.id === item.source.id);
    if (existing) {
      existing.fieldIds.push(item.field.id);
    } else {
      result.push(citationFor(item.source, [item.field]));
    }
    return result;
  }, []);

  if (!dependencies.sources && (!reviewedCollection || usable.some(({ source, field }) =>
    source.id !== "mois-waste-api-seongnam" || field.id !== "non-collection-sunday-holidays"))) return {
    status: "insufficient",
    message: "현재 확인된 시 단위 미수거 안내만으로는 해당 날짜·시간·품목·개별 지역의 수거 여부를 확정할 수 없어요. 공식 출처에서 상세 안내를 확인해 주세요.",
    sources: citations,
  };
  const scopeNote = reviewedCollection
    ? `성남시 공통 수거 안내이며 선택한 동의 배출 요일이나 개별 건물의 수거 일정은 확인하지 않았어요. 자료 기준일은 ${usable[0].source.dataAsOf ?? "미확인"}, 공식 안내 대조일은 ${usable[0].source.checkedAt}입니다. 특정 날짜·명절·변경 여부는 공식 안내를 확인해 주세요.`
    : "";
  const collectionFallback: SearchResult | undefined = reviewedCollection && usable.every(({ source, field }) =>
    source.id === "mois-waste-api-seongnam" && field.id === "non-collection-sunday-holidays")
    ? { status: "answered", answerMode: "source", answer: `${usable.map(({ field }) => field.content).join(" ")}\n\n${scopeNote}`, sources: citations }
    : undefined;

  // Production generation requires a separate opt-in, never just a stored key.
  // Injected generators are offline test doubles, not production configuration.
  if (dependencies.staticOnly || !dependencies.generateAnswer && (process.env.LLM_SEARCH_ENABLED !== "true" ||
    !process.env.LLM_API_KEY?.trim() || !process.env.LLM_BASE_URL?.trim() || !process.env.LLM_MODEL?.trim())) {
    if (collectionFallback) return collectionFallback;
    return {
      status: "insufficient",
      message: "현재는 공식 자료 안내를 제공하고 있어요. 자세한 내용은 아래 공식 출처를 확인해 주세요.",
      sources: citations,
    };
  }

  try {
    const answer = await withTimeout(
      (signal) =>
        (dependencies.generateAnswer ?? generateWithLlm)(
          input.question,
          usable.map(({ source, field }) => ({
            sourceId: source.id,
            id: field.id,
            content: field.content,
            regionName: source.regionName,
            dataAsOf: source.dataAsOf,
            checkedAt: source.checkedAt,
          })),
          signal,
        ),
      dependencies.timeoutMs ?? SEARCH_TIMEOUT_MS,
    );
    if (!answer.trim()) {
      throw new Error("EMPTY_LLM_ANSWER");
    }
    const bodyLimit = MAX_ANSWER_LENGTH - (scopeNote ? scopeNote.length + 2 : 0);
    const body = answer.length > bodyLimit ? `${answer.slice(0, bodyLimit - 1)}…` : answer;
    return {
      status: "answered",
      answerMode: "generated",
      answer: scopeNote ? `${body}\n\n${scopeNote}` : body,
      sources: citations,
    };
  } catch (error) {
    if (collectionFallback) return collectionFallback;
    if (error instanceof Error && error.message === "SEARCH_TIMEOUT") {
      return {
        status: "timeout",
        message: "답변 생성 시간이 초과됐어요. 잠시 후 다시 시도하거나 공식 출처를 확인해 주세요.",
        sources: citations,
      };
    }
    return {
      status: "insufficient",
      message: "답변을 생성하지 못했어요. 아래 공식 출처에서 내용을 확인해 주세요.",
      sources: citations,
    };
  }
}

export function createSearchRateLimiter(limit: number, windowMs: number) {
  const requests: number[] = [];
  return (now = Date.now()) => {
    while (requests.length > 0 && now - requests[0] >= windowMs) {
      requests.shift();
    }
    if (requests.length >= limit) return false;
    requests.push(now);
    return true;
  };
}

export const allowSearchRequest = createSearchRateLimiter(10, 60_000);
