import { getKoreanDateKey, getWeekDateKeys, type OfficialSchedule } from "./calendar";

export type OfficialEvent = OfficialSchedule & {
  displayRegion: "성남시" | "수정구" | "중원구" | "분당구";
  venue: string | null;
  audience: string;
  applicationNote: string;
  terms: "KOGL-4";
};

// Manually checked factual event metadata only. No source body, posters or images.
// Sources display KOGL-4; not a bulk-harvested or unrestricted content dataset.
export const officialEvents: readonly OfficialEvent[] = [
  {
    id: "seongnam-event-6553",
    title: "11월 은행골어울터 교육 유기농 음식 만들기·라탄공예",
    regionName: "중원구",
    displayRegion: "중원구",
    eventDate: null, eventDates: ["2026-11-24", "2026-11-25"],
    applicationStartsOn: "2026-10-30", applicationEndsOn: null, closingDate: null,
    venue: "은행골어울터 (중원구 은이로 11)", audience: "청소년 이상",
    applicationNote: "강좌별 신청 마감은 원문 확인. 목록·본문의 마감 표기가 달라 공통 마감일은 표시하지 않습니다.",
    sourceName: "성남시 자치행정과", sourceUrl: "https://www.seongnam.go.kr/pm010201/6553",
    checkedAt: "2026-11-08", terms: "KOGL-4",
  },
  {
    id: "seongnam-event-6555",
    title: "결혼준비학교 참여자 모집 안내(성남시 가족센터)",
    regionName: "성남시 공식 안내",
    displayRegion: "성남시",
    eventDate: "2026-11-14",
    applicationStartsOn: "2026-10-19", applicationEndsOn: null, closingDate: null,
    venue: "성남시가족센터 교육실", audience: "성남시 거주 결혼을 앞둔 예비부부",
    applicationNote: "선착순 마감. 현재 신청 가능 여부는 원문에서 확인해 주세요.",
    sourceName: "성남시 여성가족과", sourceUrl: "https://www.seongnam.go.kr/pm010201/6555",
    checkedAt: "2026-11-08", terms: "KOGL-4",
  },
  {
    id: "seongnam-event-6554",
    title: "신영철 원장의 알기쉬운 중독 이야기 (성남시중독관리통합지원센터 주민대상교육)",
    regionName: "성남시 공식 안내",
    displayRegion: "성남시",
    eventDate: "2026-11-23",
    applicationStartsOn: "2026-10-12", applicationEndsOn: "2026-11-20", closingDate: "2026-11-20",
    venue: null, audience: "누구나 (공식 게시물 표기)",
    applicationNote: "신청 마감 11월 20일 18:00. 장소·잔여 정원은 공식 안내를 확인해 주세요.",
    sourceName: "성남시 분당구보건소", sourceUrl: "https://www.seongnam.go.kr/pm010201/6554",
    checkedAt: "2026-11-08", terms: "KOGL-4",
  },
];

// Discovery/display scope, not a claim about residency requirements.
export function filterEventsByLocation(events: readonly OfficialEvent[], location: string): OfficialEvent[] {
  if (!location.includes("성남")) return [];
  const district = location.match(/수정구|중원구|분당구/u)?.[0];
  return events.filter((event) => !district || event.displayRegion === "성남시" || event.displayRegion === district);
}

export function getEventDates(event: OfficialSchedule): readonly string[] {
  return event.eventDates ?? (event.eventDate ? [event.eventDate] : []);
}

export function getUpcomingEvents(today = getKoreanDateKey(), events = officialEvents): OfficialEvent[] {
  return events.filter((event) => getEventDates(event).some((date) => date >= today))
    .sort((a, b) => getEventDates(a).filter((date) => date >= today)[0].localeCompare(getEventDates(b).filter((date) => date >= today)[0]));
}

export function searchOfficialEvents(question: string, today = getKoreanDateKey(), events = officialEvents): OfficialEvent[] {
  let start = today;
  let end = "9999-12-31";
  if (/이번\s*주/u.test(question)) {
    const week = getWeekDateKeys(today);
    [start, end] = [week[0], week[6]];
  } else {
    const month = question.match(/(?:(20\d{2})년\s*)?(1[0-2]|0?[1-9])월/u);
    if (month) {
      const year = month[1] ?? today.slice(0, 4);
      const prefix = `${year}-${month[2].padStart(2, "0")}`;
      start = `${prefix}-01`;
      end = `${prefix}-${new Date(Date.UTC(Number(year), Number(month[2]), 0)).getUTCDate()}`;
    }
  }
  const topics = ["라탄", "유기농", "결혼", "중독", "은행골"].filter((word) => question.includes(word));
  return events.filter((event) => {
    if (topics.length && !topics.some((topic) => event.title.includes(topic))) return false;
    const eventInPeriod = getEventDates(event).some((date) => start <= date && date <= end);
    // Open-ended/first-come recruitment is not assumed to remain open.
    const recruitmentInPeriod = event.applicationStartsOn && event.applicationEndsOn &&
      event.applicationStartsOn <= end && event.applicationEndsOn >= start;
    return eventInPeriod || (/모집|접수|신청/u.test(question) && Boolean(recruitmentInPeriod));
  });
}
