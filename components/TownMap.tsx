"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinned } from "lucide-react";
import { NeighborhoodMap } from "./NeighborhoodMap";
import { DirectionsLink } from "./DirectionsLink";
import { resolveCenterLocation } from "@/lib/center-location-client";
import { getNaverMapSearchUrl } from "@/lib/map-links";
import { distanceKm, mapCategories, visibleTownPlaces, type MapCategory, type TownMapData, type TownPlace } from "@/lib/neighborhood-map";

export function TownMap({ locationId }: { locationId: string }) {
  const [data, setData] = useState<TownMapData>();
  const [center, setCenter] = useState<TownPlace>();
  const [message, setMessage] = useState("지도에 표시할 시설을 불러오고 있어요.");
  const [category, setCategory] = useState<MapCategory>(locationId === "citywide" ? "all" : "center");
  const [nearby, setNearby] = useState(locationId !== "citywide");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(`/api/neighborhood-map?locationId=${encodeURIComponent(locationId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("map data unavailable");
        const payload: TownMapData = await response.json();
        if (!active) return;
        setData(payload);
        if (!payload.center) { setMessage(""); return; }
        setMessage("선택한 동의 주민센터 위치를 확인하고 있어요.");
        const destination = await resolveCenterLocation(payload.center);
        if (!active) return;
        if (!destination) {
          setMessage("주민센터 위치를 확인하지 못했어요. 센터명으로 웹 지도를 검색하거나 성남시 전체 시설을 살펴보세요.");
          return;
        }
        setCenter({ ...destination, id: payload.center.id, category: "center", hours: "방문 전 공식 안내를 확인해 주세요.", closedDays: "", sourceUrl: payload.center.sourceUrl, dataAsOf: payload.center.dataAsOf });
        setSelectedId(payload.center.id);
        setMessage("");
      }).catch(() => { if (active) setMessage("시설을 불러오지 못했어요. 잠시 후 새로고침해 주세요."); });
    return () => { active = false; controller.abort(); };
  }, [locationId]);

  const places = useMemo(() => visibleTownPlaces(data?.facilities ?? [], center, category, nearby), [data, center, category, nearby]);
  const points = useMemo(() => places.map((place) => ({ id: place.id, name: place.name, latitude: Number(place.latitude), longitude: Number(place.longitude) })), [places]);
  const selected = places.find((place) => place.id === selectedId);
  const selectPlace = (id: string) => { setSelectedId(id); setSelectionVersion((value) => value + 1); };
  const changeScope = (value: boolean) => { setNearby(value); setSelectedId(null); if (category === "center") setCategory("all"); };

  return <article className="info-detail-card town-map-card" id="town-map">
    <span className="detail-icon map-detail-icon"><MapPinned size={20} /></span>
    <span className="detail-status">생활시설 둘러보기</span>
    <h3>동네 지도</h3>
    <p>주민센터와 이용할 수 있는 공공시설을 찾아보세요. 현재 위치 권한 없이도 볼 수 있어요.</p>
    <div className="town-map-scope" role="group" aria-label="시설 표시 범위">
      {locationId !== "citywide" && <button type="button" aria-pressed={nearby} onClick={() => changeScope(true)}>주민센터 주변 3km</button>}
      <button type="button" aria-pressed={!nearby} onClick={() => changeScope(false)}>성남시 전체</button>
    </div>
    <div className="town-map-categories" role="group" aria-label="시설 종류">
      {mapCategories.filter((item) => item.id !== "center" || locationId !== "citywide").map((item) => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setSelectedId(null); }}>{item.label}</button>)}
    </div>
    {message && <p className="town-map-status" role="status">{message}</p>}
    {data?.center && !center && <a href={getNaverMapSearchUrl(data.center.centerName, `성남시 ${data.center.district}`)!} target="_blank" rel="noreferrer">{data.center.centerName} 웹 지도 검색 ↗</a>}
    <NeighborhoodMap points={points} selectedPointId={selected?.id ?? null} selectionVersion={selectionVersion} onSelectPoint={selectPlace} />
    <div className="town-map-list-heading"><strong>{nearby ? "주민센터 주변" : "성남시 전체"} · {places.length}곳</strong><span>핀이나 이름을 눌러보세요</span></div>
    {!places.length && data && <p className="town-map-status">{nearby && !center ? "주민센터 좌표가 확인되면 주변 시설을 표시할 수 있어요." : "현재 자료에 해당하는 시설이 없어요. 다른 종류나 성남시 전체를 선택해 주세요."}</p>}
    <ul className="town-map-list" aria-label="지도 시설 목록">
      {places.map((place) => <li key={place.id}><button type="button" aria-pressed={selected?.id === place.id} onClick={() => selectPlace(place.id)}><span>{place.name}<small>{place.address}</small></span>{center && <em>{distanceKm(center, place).toFixed(1)}km</em>}</button></li>)}
    </ul>
    {selected && <section className="town-map-detail" aria-label="선택한 시설 정보">
      <span>{mapCategories.find((item) => item.id === selected.category)?.label}</span>
      <h4>{selected.name}</h4><p>{selected.address}</p>
      <p>이용 시간: {selected.hours}{selected.closedDays && <><br />휴관: {selected.closedDays}</>}</p>
      <div><a href={selected.sourceUrl} target="_blank" rel="noreferrer">공식 안내·자료 ↗</a><DirectionsLink key={selected.id} destination={selected} searchUrl={getNaverMapSearchUrl(selected.name, "성남시")!} /></div>
      <small>자료 기준 {selected.dataAsOf} · 운영·예약 여부는 공식 안내를 확인해 주세요.</small>
    </section>}
    <p className="town-map-footnote">{nearby ? "거리는 주민센터 기준 직선거리이며 행정동 경계나 도보 거리를 뜻하지 않아요. " : ""}도서관·공원은 확보한 대관공간 일부를 표시해요. 수거함 위치는 아직 제공하지 않아요.</p>
  </article>;
}
