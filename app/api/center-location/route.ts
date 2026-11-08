import { NextResponse, type NextRequest } from "next/server";
import { seongnamCenters } from "@/lib/server/seongnam-centers";
import { matchCenterLocation } from "@/lib/center-location-match";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
let windowStart = 0;
let requestCount = 0;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const center = seongnamCenters.find((item) => item.id === id);
  if (!center) return NextResponse.json({ message: "센터를 찾지 못했어요." }, { status: 404, headers });
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (process.env.NAVER_CENTER_LOOKUP_ENABLED !== "true" || !clientId || !secret) {
    return NextResponse.json({ message: "센터명 자동 지도 연결을 준비 중이에요. 현재는 웹 지도에서 센터명을 검색할 수 있어요." }, { status: 503, headers });
  }
  const now = Date.now();
  if (now - windowStart >= 60_000) { windowStart = now; requestCount = 0; }
  if (++requestCount > 10) return NextResponse.json({ message: "요청이 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429, headers });
  try {
    const url = new URL("https://naverapihub.apigw.ntruss.com/search/v1/local");
    url.searchParams.set("query", `성남시 ${center.district} ${center.centerName}`);
    url.searchParams.set("display", "5");
    url.searchParams.set("format", "json");
    const response = await fetch(url, { headers: { "X-NCP-APIGW-API-KEY-ID": clientId, "X-NCP-APIGW-API-KEY": secret }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("LOOKUP_FAILED");
    const destination = matchCenterLocation(center, await response.json());
    if (!destination) return NextResponse.json({ message: "이름과 주소가 일치하는 센터 위치를 확정하지 못했어요. 웹 지도에서 직접 확인해 주세요." }, { status: 422, headers });
    return NextResponse.json({ destination }, { headers });
  } catch {
    return NextResponse.json({ message: "센터 위치를 조회하지 못했어요. 웹 지도 검색을 이용해 주세요." }, { status: 502, headers });
  }
}
