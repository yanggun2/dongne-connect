"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";

export type MapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type NaverLatLng = object;

type NaverMarker = {
  setMap(map: NaverMap | null): void;
  setZIndex(index: number): void;
};

type NaverMap = {
  setCenter(position: NaverLatLng): void;
  setZoom(zoom: number): void;
  fitBounds(points: NaverLatLng[], options: { top: number; right: number; bottom: number; left: number; maxZoom: number }): void;
  destroy(): void;
};

type NaverMaps = {
  Map: new (
    element: HTMLElement,
    options: { center: NaverLatLng; zoom: number },
  ) => NaverMap;
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMap;
    title: string;
  }) => NaverMarker;
  Event: {
    addListener(
      target: NaverMarker,
      eventName: "click",
      listener: () => void,
    ): void;
  };
};

declare global {
  interface Window {
    naver?: { maps: NaverMaps };
    navermap_authFailure?: () => void;
  }
}

type NeighborhoodMapProps = {
  points: readonly MapPoint[];
  selectedPointId: string | null;
  selectionVersion?: number;
  onSelectPoint: (id: string) => void;
};

const MAP_SCRIPT_ID = "dongneil-naver-maps";
const authListeners = new Set<() => void>();

export function NeighborhoodMap({
  points,
  selectedPointId,
  selectionVersion = 0,
  onSelectPoint,
}: NeighborhoodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef(new Map<string, NaverMarker>());
  const pointsRef = useRef(points);
  const onSelectPointRef = useRef(onSelectPoint);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const hasPoints = points.length > 0;
  pointsRef.current = points;
  onSelectPointRef.current = onSelectPoint;

  useEffect(() => {
    if (!clientId || !hasPoints || !containerRef.current) return;
    let active = true;
    // The SDK owns only this imperative child, never a React-rendered placeholder.
    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    containerRef.current.appendChild(host);

    const initializeMap = () => {
      if (!active || !containerRef.current || !window.naver?.maps) return;
      const { maps } = window.naver;
      const firstPoint = pointsRef.current[0];
      if (!firstPoint) return;
      const center = new maps.LatLng(firstPoint.latitude, firstPoint.longitude);
      if (!mapRef.current) {
        mapRef.current = new maps.Map(host, { center, zoom: 13 });
      }
      setMapError("");
      setMapReady(true);
    };

    const authFailure = () => {
      if (active) setMapError("지도 인증을 확인할 수 없어요. 등록한 웹 서비스 URL과 Client ID를 확인해 주세요.");
    };
    authListeners.add(authFailure);
    window.navermap_authFailure = () => authListeners.forEach((listener) => listener());
    const loadFailure = () => {
      if (active) setMapError("지도를 불러오지 못했어요. 잠시 후 새로고침해 주세요.");
    };

    const existingScript = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (window.naver?.maps) {
      initializeMap();
    } else if (existingScript) {
      existingScript.addEventListener("load", initializeMap, { once: true });
      existingScript.addEventListener("error", loadFailure, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = MAP_SCRIPT_ID;
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
      script.async = true;
      script.addEventListener("load", initializeMap, { once: true });
      script.addEventListener("error", loadFailure, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      active = false;
      authListeners.delete(authFailure);
      const script = document.getElementById(MAP_SCRIPT_ID);
      script?.removeEventListener("load", initializeMap);
      script?.removeEventListener("error", loadFailure);
      for (const marker of markersRef.current.values()) marker.setMap(null);
      markersRef.current.clear();
      mapRef.current?.destroy();
      mapRef.current = null;
      host.remove();
      setMapReady(false);
    };
  }, [clientId, hasPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.naver?.maps) return;
    const { maps } = window.naver;

    for (const marker of markersRef.current.values()) marker.setMap(null);
    markersRef.current.clear();

    for (const point of points) {
      const marker = new maps.Marker({
        position: new maps.LatLng(point.latitude, point.longitude),
        map,
        title: point.name,
      });
      maps.Event.addListener(marker, "click", () => onSelectPointRef.current(point.id));
      markersRef.current.set(point.id, marker);
    }
  }, [mapReady, points]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.naver?.maps) return;
    if (!selectedPointId && points.length) {
      mapRef.current.fitBounds(points.map((point) => new window.naver!.maps.LatLng(point.latitude, point.longitude)), { top: 40, right: 40, bottom: 40, left: 40, maxZoom: 16 });
      return;
    }
    if (!selectedPointId) return;
    const selected = points.find((point) => point.id === selectedPointId);
    const marker = markersRef.current.get(selectedPointId);
    if (!selected || !marker) return;
    mapRef.current.setCenter(new window.naver.maps.LatLng(selected.latitude, selected.longitude));
    mapRef.current.setZoom(16);
    for (const otherMarker of markersRef.current.values()) otherMarker.setZIndex(0);
    marker.setZIndex(100);
  }, [mapReady, points, selectedPointId, selectionVersion]);

  // Keep the canvas mounted across empty/nonempty transitions. React must not
  // reuse an SDK-mutated canvas as the parent of its own text/strong elements.
  return (
    <section className={`neighborhood-map${!clientId || !hasPoints ? " map-not-configured" : ""}`} aria-label="동네 지도">
      {!clientId ? <div key="not-configured" className="map-empty-state">
        <div className="map-placeholder-icon"><MapPinned size={22} /></div>
        <div>
          <strong>지도 연결 준비 중</strong>
          <p>지도를 준비하고 있어요. 아래 시설 목록과 웹 길찾기를 이용해 주세요.</p>
        </div>
      </div> : !hasPoints ? <div key="no-points" className="map-empty-state">
        <div className="map-placeholder-icon"><MapPinned size={22} /></div>
        <div>
          <strong>표시할 위치 정보가 없어요</strong>
          <p>공식 주소와 유효한 좌표가 모두 확인된 시설만 지도에 표시합니다.</p>
        </div>
      </div> : null}
      {mapError && <p className="map-error" role="status">{mapError}</p>}
      <div key="canvas" className="neighborhood-map-canvas" ref={containerRef} hidden={!clientId || !hasPoints} />
    </section>
  );
}
