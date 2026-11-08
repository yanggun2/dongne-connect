import { getCoordinates, type MapDestination } from "./map-links";

type CenterIdentity = { centerName: string; address: string; district: string };
const normalize = (value: string) => value.replace(/<[^>]*>/g, "").replace(/주민센터/g, "행정복지센터").replace(/\([^)]*\)/g, "").replace(/경기도/g, "경기").replace(/\s/g, "");

export function matchCenterLocation(center: CenterIdentity, payload: unknown): MapDestination | undefined {
  if (!payload || typeof payload !== "object" || !("items" in payload) || !Array.isArray(payload.items)) return undefined;
  const matches: MapDestination[] = [];
  for (const item of payload.items) {
    if (!item || typeof item !== "object" || typeof item.title !== "string" || typeof item.roadAddress !== "string") continue;
    if (normalize(item.title) !== normalize(center.centerName) || normalize(item.roadAddress) !== normalize(center.address)) continue;
    if (!item.roadAddress.includes("성남시") || !item.roadAddress.includes(center.district)) continue;
    const x = Number(item.mapx), y = Number(item.mapy);
    const destination = {
      name: center.centerName, address: center.address,
      latitude: String(y > 90 ? y / 10_000_000 : y),
      longitude: String(x > 180 ? x / 10_000_000 : x),
    };
    if (getCoordinates(destination)) matches.push(destination);
  }
  return matches.length === 1 ? matches[0] : undefined;
}
