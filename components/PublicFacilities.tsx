"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Search } from "lucide-react";
import { mapCategories, type MapCategory, type TownMapData } from "@/lib/neighborhood-map";
import { getNaverMapSearchUrl } from "@/lib/map-links";
import { DirectionsLink } from "./DirectionsLink";

export function PublicFacilities({ location }: { location: string }) {
  const district = location.match(/수정구|중원구|분당구/u)?.[0];
  const [data, setData] = useState<TownMapData>();
  const [error, setError] = useState("");
  const [citywide, setCitywide] = useState(!district);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MapCategory>("all");
  const [limit, setLimit] = useState(6);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/neighborhood-map?locationId=citywide", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("FACILITIES_UNAVAILABLE");
      setData(await response.json());
    }).catch(() => { if (!controller.signal.aborted) setError("시설 목록을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요."); });
    return () => controller.abort();
  }, []);
  useEffect(() => setLimit(6), [category, query, citywide]);
  const facilities = useMemo(() => (data?.facilities ?? []).filter((item) =>
    (citywide || !district || item.address.includes(`성남시 ${district} `)) &&
    (category === "all" || category === item.category) &&
    `${item.name} ${item.address}`.includes(query.trim())), [data, district, citywide, category, query]);
  return <section className="public-facilities" aria-label="공공시설 목록">
    <div className="directory-toolbar"><label className="directory-search"><Search size={21} /><span className="sr-only">공공시설 검색</span><input placeholder="시설 이름이나 주소로 찾아보세요" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{district && <div className="scope-switch" role="group" aria-label="공공시설 지역 범위"><button type="button" aria-pressed={!citywide} onClick={() => setCitywide(false)}>{district}</button><button type="button" aria-pressed={citywide} onClick={() => setCitywide(true)}>성남시 전체</button></div>}</div>
    <div className="directory-categories" role="group" aria-label="공공시설 종류">{mapCategories.filter((item) => item.id !== "center").map((item) => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>
    <div className="directory-result-summary"><strong>{citywide ? "성남시 전체" : district} · {facilities.length}곳</strong><p>공식 주소 기준 자료예요. 선택한 동의 경계 안에 있는 시설만을 뜻하지는 않아요.</p></div>
    {error && <p className="page-empty" role="alert">{error}</p>}
    {!data && !error && <p role="status">시설을 불러오고 있어요.</p>}
    {data && !facilities.length && <div className="page-empty"><Search size={27} /><h2>해당하는 시설이 없어요</h2><p>다른 검색어나 시설 종류로 찾아보세요.</p></div>}
    <div className="directory-grid">{facilities.slice(0, limit).map((facility) => <article className="directory-card" key={facility.id}>
      <div className="directory-card-top"><span className="directory-card-icon"><Building2 size={22} /></span><span>{mapCategories.find((item) => item.id === facility.category)?.label}</span></div><h2>{facility.name}</h2><p className="directory-address"><MapPin size={16} />{facility.address}</p><dl><div><dt>이용 시간</dt><dd>{facility.hours}</dd></div><div><dt>휴관일</dt><dd>{facility.closedDays || "공식 안내에서 확인"}</dd></div></dl><div className="directory-card-links"><a href={facility.sourceUrl} target="_blank" rel="noreferrer">공식 안내 ↗</a><DirectionsLink destination={facility} searchUrl={getNaverMapSearchUrl(facility.name, "성남시")!} /></div><small>자료 기준 {facility.dataAsOf} · 예약·운영 여부는 공식 안내를 확인해 주세요.</small>
    </article>)}</div>
    {facilities.length > limit && <button type="button" className="load-more-button" onClick={() => setLimit((value) => value + 6)}>시설 더 보기 ({Math.min(limit, facilities.length)}/{facilities.length})</button>}
  </section>;
}
