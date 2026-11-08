import { ExternalLink } from "lucide-react";
import { getEventDates, type OfficialEvent } from "@/lib/official-events";

export function OfficialEventCard({ event }: { event: OfficialEvent }) {
  return <article className="official-event-card">
    <h4>{event.title}</h4>
    <p>{event.displayRegion === "성남시" ? "성남시" : `${event.displayRegion} 행사`}</p>
    <p>행사일: {getEventDates(event).join(" · ")}</p>
    <p>장소: {event.venue ?? "원문에서 확인"}</p>
    <p>대상: {event.audience}</p>
    <p>신청 방법·잔여 정원은 공식 안내에서 확인해 주세요.</p>
    <a href={event.sourceUrl} target="_blank" rel="noreferrer">공식 상세 안내 <ExternalLink size={14} /></a>
    <small>출처: 2026년 {event.sourceName} · 확인 {event.checkedAt} · 공공누리 제4유형(출처표시·비상업적 이용·변경금지)</small>
  </article>;
}
