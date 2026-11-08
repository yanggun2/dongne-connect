import { getCoordinates, type MapDestination } from "./map-links";

export const mapCategories = [
  { id: "all", label: "전체" },
  { id: "center", label: "주민센터" },
  { id: "sports", label: "체육시설" },
  { id: "library", label: "도서관 공간" },
  { id: "outdoor", label: "공원·야외" },
  { id: "space", label: "대관공간" },
] as const;
export type MapCategory = typeof mapCategories[number]["id"];
export type TownPlace = MapDestination & {
  id: string;
  category: Exclude<MapCategory, "all">;
  hours: string;
  closedDays: string;
  sourceUrl: string;
  dataAsOf: string;
};
export type TownCenter = { id: string; centerName: string; address: string; district: string; sourceUrl: string; dataAsOf: string };
export type TownMapData = { center: TownCenter | null; facilities: TownPlace[] };

// Exact source record IDs: these are bookable spaces, not a complete library/park inventory.
const libraries = new Set(["수정도서관 미디어 창작실", "중원도서관 미디어공방", "판교어린이도서관 시청각실", "판교어린이도서관 미디어창작소"]);
const outdoor = new Set(["성남종합운동장 공원녹지대 / 광장 및 도로", "운중체육공원1,2,3", "단대근린공원 다목적구장", "시청공원 저류지 체육시설"]);
const spaceTypes = new Set(["회의실", "강당", "강의실", "다목적실"]);
export function facilityMapCategory(id: string, type: string): TownPlace["category"] {
  if (libraries.has(id)) return "library";
  if (outdoor.has(id)) return "outdoor";
  return spaceTypes.has(type) ? "space" : "sports";
}

export function distanceKm(a: MapDestination, b: MapDestination): number {
  const first = getCoordinates(a), second = getCoordinates(b);
  if (!first || !second) return Infinity;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(second.latitude - first.latitude);
  const dLng = radians(second.longitude - first.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function visibleTownPlaces(facilities: TownPlace[], center: TownPlace | undefined, category: MapCategory, nearby: boolean): TownPlace[] {
  const places = [...(center ? [center] : []), ...facilities].filter((place) => getCoordinates(place) &&
    (category === "all" || place.category === category) &&
    (!nearby || (center && distanceKm(center, place) <= 3)));
  return places.sort((a, b) => center ? distanceKm(center, a) - distanceKm(center, b) || a.name.localeCompare(b.name, "ko") : a.name.localeCompare(b.name, "ko"));
}
