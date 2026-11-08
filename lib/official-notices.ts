export type OfficialNotice = {
  id: string;
  title: string;
  publishedOn: string;
  department: string;
  sourceUrl: string;
  checkedAt: string;
  license: "KOGL-0" | "KOGL-3" | "KOGL-4";
};

// Manually checked title/date/department/link only. No body or attachments.
export const officialNotices: readonly OfficialNotice[] = [
  { id: "seongnam-notice-405886", title: "2035 성남시 노후계획도시정비기본계획(경미한 변경) 고시", publishedOn: "2026-11-06", department: "도시정비국 > 도시개발과", sourceUrl: "https://www.seongnam.go.kr/bbs010101/405886", checkedAt: "2026-11-08", license: "KOGL-4" },
  { id: "seongnam-notice-405873", title: "11월 2주 서울공항 야간비행 훈련 일정 알림", publishedOn: "2026-11-05", department: "행정기획조정실 > 총무과", sourceUrl: "https://www.seongnam.go.kr/bbs010101/405873", checkedAt: "2026-11-08", license: "KOGL-3" },
  { id: "seongnam-notice-405855", title: "판교보건지소 정신건강 AI 체험관 [마인드피트니스] 운영", publishedOn: "2026-11-04", department: "분당구보건소 > 판교보건지소", sourceUrl: "https://www.seongnam.go.kr/bbs010101/405855", checkedAt: "2026-11-08", license: "KOGL-0" },
];

export function searchOfficialNotices(question: string): OfficialNotice[] {
  const topics = ["야간", "비행", "서울공항", "판교", "마인드피트니스", "체험관", "정신건강", "노후계획", "정비", "고시"].filter((topic) => question.includes(topic));
  return officialNotices.filter((notice) => !topics.length || topics.some((topic) => notice.title.includes(topic)));
}
