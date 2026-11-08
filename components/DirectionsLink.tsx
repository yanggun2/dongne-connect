"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { getNaverWebDirectionsUrl, isUsableLocationAccuracy, type MapDestination } from "@/lib/map-links";
import { NeighborhoodMap } from "./NeighborhoodMap";

export function DirectionsLink({ destination, searchUrl }: {
  destination?: MapDestination;
  searchUrl: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [routeUrl, setRouteUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const previewPointId = "route-origin";
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  function locate() {
    setRouteUrl(null);
    setLocation(null);
    if (!window.isSecureContext) {
      setMessage("현재 위치는 HTTPS 또는 localhost에서 사용할 수 있어요. 웹 지도에서 출발지를 직접 선택해 주세요.");
      return;
    }
    if (!navigator.geolocation) {
      setMessage("현재 위치를 지원하지 않는 브라우저예요. 웹 지도에서 출발지를 직접 선택해 주세요.");
      return;
    }
    setPending(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition((position) => {
      if (!active.current || !destination) return;
      const url = getNaverWebDirectionsUrl(position.coords, destination);
      setPending(false);
      const { latitude, longitude, accuracy } = position.coords;
      if (!isUsableLocationAccuracy(accuracy)) {
        setMessage("현재 위치의 오차가 너무 커서 출발지로 사용하지 않았어요. PC 위치 설정을 확인하거나 출발지를 직접 선택해 주세요.");
        return;
      }
      if (url) {
        setRouteUrl(url);
        setLocation({ latitude, longitude, accuracy });
      }
      else setMessage("위치를 확인하지 못했어요. 웹 지도에서 출발지를 직접 선택해 주세요.");
    }, (error) => {
      if (!active.current) return;
      setPending(false);
      setMessage(error.code === 1
        ? "위치 권한이 허용되지 않았어요. 웹 지도에서 출발지를 직접 선택해 주세요."
        : "현재 위치를 확인하지 못했어요. 다시 시도하거나 웹 지도에서 출발지를 직접 선택해 주세요.");
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  }

  return (
    <div>
    <div className="facility-links">
      {destination ? (
        <>
          <button className="facility-route-link" type="button" disabled={pending} onClick={locate}>
            <MapPin size={16} aria-hidden="true" />{pending ? "현재 위치 확인 중…" : "길찾기"}
          </button>
          <span className="facility-result-note">인식한 출발지를 먼저 확인해 주세요. 지도 표시와 웹 길찾기에 위치가 사용돼요. 서비스에 위치를 저장하지 않아요.</span>
          {routeUrl && <a className="facility-route-link" href={routeUrl} target="_blank" rel="noopener noreferrer">이 위치에서 웹 길찾기 열기</a>}
          <a href={searchUrl} target="_blank" rel="noopener noreferrer">출발지 직접 선택</a>
        </>
      ) : (
        <>
          <a className="facility-route-link" href={searchUrl} target="_blank" rel="noopener noreferrer"><MapPin size={16} aria-hidden="true" />길찾기</a>
          <span className="facility-result-note">웹 지도에서 센터명으로 검색해요. 센터 좌표가 없어 출발지 자동 연결은 아직 지원하지 않아요.</span>
        </>
      )}
      <span role="status" className="facility-result-note">{message || (location ? `인식한 출발지의 예상 오차는 약 ${Math.ceil(location.accuracy)}m예요. 실제 위치가 맞는지 확인해 주세요. PC에서는 위치가 부정확할 수 있어요.` : "")}</span>
    </div>
    {location && <NeighborhoodMap points={[{ id: previewPointId, name: "인식한 출발지", latitude: location.latitude, longitude: location.longitude }]} selectedPointId={previewPointId} onSelectPoint={() => {}} />}
    </div>
  );
}
