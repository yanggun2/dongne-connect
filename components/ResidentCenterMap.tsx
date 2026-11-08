"use client";

import { useEffect, useState } from "react";
import type { ResidentCenterSearchRecord } from "@/lib/search-types";
import { getNaverMapSearchUrl, type MapDestination } from "@/lib/map-links";
import { resolveCenterLocation } from "@/lib/center-location-client";
import { getCenterMapDestination } from "@/lib/center-map-reference";
import { NeighborhoodMap } from "./NeighborhoodMap";
import { DirectionsLink } from "./DirectionsLink";

export function ResidentCenterMap({ center }: { center: ResidentCenterSearchRecord }) {
  const [destination, setDestination] = useState<MapDestination | undefined>(() => getCenterMapDestination(center));
  const [message, setMessage] = useState("");
  useEffect(() => {
    const known = getCenterMapDestination(center);
    setDestination(known);
    if (known) { setMessage("지도 좌표는 제공해 주신 NAVER 공유 링크 기준이에요."); return; }
    let active = true;
    setMessage("센터명으로 지도 위치를 확인하고 있어요.");
    void resolveCenterLocation(center)
      .then((point) => {
        if (!active) return;
        if (!point) { setMessage("센터 위치를 확인하지 못했어요. 웹 지도 검색을 이용해 주세요."); return; }
        setDestination(point);
        setMessage("NAVER 센터명 검색 결과의 이름·주소를 공식 센터 자료와 대조한 위치예요.");
      })
    return () => { active = false; };
  }, [center]);
  return <>
    {destination && <NeighborhoodMap points={[{ id: center.id, name: destination.name, latitude: Number(destination.latitude), longitude: Number(destination.longitude) }]} selectedPointId={center.id} onSelectPoint={() => {}} />}
    <p className="facility-result-note" role="status">{message}</p>
    <DirectionsLink key={center.id} destination={destination} searchUrl={getNaverMapSearchUrl(center.centerName, `성남시 ${center.district}`)!} />
  </>;
}
