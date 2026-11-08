import { ExternalLink } from "lucide-react";
import type { OfficialNotice } from "@/lib/official-notices";

const licenseLabels = {
  "KOGL-0": "공공누리 제0유형 · 자유이용",
  "KOGL-3": "공공누리 제3유형 · 출처표시·변경금지",
  "KOGL-4": "공공누리 제4유형 · 출처표시·비상업적 이용·변경금지",
};

export function OfficialNoticeList({ notices }: { notices: readonly OfficialNotice[] }) {
  return <ul className="official-notice-list">
    {notices.map((notice) => <li key={notice.id}>
      <a href={notice.sourceUrl} target="_blank" rel="noreferrer"><strong>{notice.title}</strong><ExternalLink size={15} aria-hidden="true" /></a>
      <p><time dateTime={notice.publishedOn}>{notice.publishedOn}</time> · {notice.department}</p>
      <small>출처: 2026년 성남시 · 확인 {notice.checkedAt} · {licenseLabels[notice.license]}</small>
    </li>)}
  </ul>;
}
