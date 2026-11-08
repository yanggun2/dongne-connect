"use client";

import React, { useId, useState } from "react";
import { ExternalLink, Recycle } from "lucide-react";
import {
  getWasteGuidance, wasteCategories, wasteCategoryLabels,
  WASTE_PORTAL_URL, WASTE_BULKY_PORTAL_URL,
  type WasteCategory, type WasteHousing,
} from "@/lib/waste-guide";

export function WasteGuide({ location, initialCategory = "general", initialHousing = "unknown" }: {
  location: string; initialCategory?: WasteCategory; initialHousing?: WasteHousing;
}) {
  const [category, setCategory] = useState<WasteCategory>(initialCategory);
  const [housing, setHousing] = useState<WasteHousing>(initialHousing);
  const housingId = useId();
  const guide = getWasteGuidance(location, category, housing);
  if (!guide) return <p>현재는 성남시 공식 자료를 안내하고 있어요. 해당 지자체의 배출 안내를 확인해 주세요.</p>;
  return <article className="info-detail-card waste-guide" id="waste-info">
    <div className="waste-guide-heading">
      <span className="detail-icon waste-detail-icon"><Recycle size={20} /></span>
      <div><h3>생활폐기물 배출 정보</h3><p>{location}</p></div>
    </div>
    <div className="waste-categories" role="group" aria-label="폐기물 종류">
      {wasteCategories.map((kind) => <button type="button" key={kind} aria-pressed={kind === category} onClick={() => setCategory(kind)}>{wasteCategoryLabels[kind]}</button>)}
    </div>
    <label className="waste-housing" htmlFor={housingId}>주택 유형
      <select id={housingId} value={housing} onChange={(event) => setHousing(event.target.value as WasteHousing)}>
        <option value="unknown">유형별 안내 모두 보기</option><option value="single">단독주택·상가</option><option value="apartment">공동주택·아파트</option>
      </select>
    </label>
    <dl className="waste-time">
      <div><dt>배출시간</dt><dd>{guide.disposalTime}</dd></div>
      {guide.collectionTime && <div><dt>수거시간</dt><dd>{guide.collectionTime}</dd></div>}
    </dl>
    <h4>{wasteCategoryLabels[category]} 배출 방법</h4>
    <ul className="waste-instructions">{guide.methods.map((method) => <li key={method}>{method}</li>)}</ul>
    <details className="waste-cautions" open>
      <summary>배출 전 확인해 주세요</summary>
      <ul>{guide.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul>
    </details>
    <div className="waste-provider">
      {guide.provider ? <>
        <strong>우리 동 수거업체 · {guide.provider.name}</strong>
        <a href={`tel:${guide.provider.phone}`}>{guide.provider.phone}</a>
        <small>공식 안내책자에 수록된 업체입니다. 변경 여부와 상세 배출일은 전화로 확인해 주세요.</small>
      </> : <><strong>동을 선택하면 수거업체를 확인할 수 있어요.</strong><small>동별로 배출 요일이 모두 다르다고 확인된 것은 아니며, 현재는 공식 표의 담당 업체를 구분해 안내합니다.</small></>}
    </div>
    <div className="waste-source-links">
      <a href={WASTE_PORTAL_URL} target="_blank" rel="noreferrer">공식 배출 안내 <ExternalLink size={14} /></a>
      {category === "bulky" && <a href={WASTE_BULKY_PORTAL_URL} target="_blank" rel="noreferrer">대형폐기물 신고 안내 <ExternalLink size={14} /></a>}
    </div>
    <small className="waste-source-note">출처: 성남시 생활폐기물 배출 안내책자 · 확인 {guide.checkedAt} · 공공누리 제4유형(출처표시·비상업적 이용·변경금지). 문서 발행·개정일은 확인되지 않아 변경 공지를 함께 확인해야 합니다.</small>
  </article>;
}
