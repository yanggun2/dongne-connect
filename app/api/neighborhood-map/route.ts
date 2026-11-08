import { NextResponse, type NextRequest } from "next/server";
import facilities from "@/lib/server/seongnam-facilities.json";
import { seongnamCenters } from "@/lib/server/seongnam-centers";
import { facilityMapCategory, type TownMapData } from "@/lib/neighborhood-map";
import { getCoordinates } from "@/lib/map-links";

export function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("locationId") ?? "citywide";
  const center = seongnamCenters.find((item) => item.id === id);
  if (id !== "citywide" && !center) return NextResponse.json({ message: "동네를 다시 선택해 주세요." }, { status: 400 });
  const data: TownMapData = {
    center: center ? { id: center.id, centerName: center.centerName, address: center.address, district: center.district, sourceUrl: center.sourceUrl, dataAsOf: center.dataAsOf } : null,
    facilities: facilities.map((item) => ({
      id: `facility:${item.id}`, name: item.name, address: item.address || item.lotAddress,
      latitude: item.latitude, longitude: item.longitude,
      category: facilityMapCategory(item.id, item.type),
      hours: `평일 ${item.weekdayStart || "미제공"}–${item.weekdayEnd || "미제공"} / 주말 ${item.weekendStart || "미제공"}–${item.weekendEnd || "미제공"}`,
      closedDays: item.closedDays,
      sourceUrl: /^https?:\/\//.test(item.homepageUrl) ? item.homepageUrl : "https://www.data.go.kr/data/15013117/standard.do",
      dataAsOf: item.dataAsOf,
    })).filter((item) => getCoordinates(item)),
  };
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=3600" } });
}
