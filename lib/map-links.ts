export type MapDestination = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
};

export function getCoordinates(destination: MapDestination): { latitude: number; longitude: number } | null {
  if (!destination.name.trim() || !destination.address.trim()) return null;
  const latitude = Number(destination.latitude);
  const longitude = Number(destination.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 31.43 ||
    latitude > 44.35 ||
    longitude < 122.37 ||
    longitude > 132
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function getNaverMapRouteUrl(
  destination: MapDestination,
  pageUrl: string,
): string | null {
  const coordinates = getCoordinates(destination);
  if (!coordinates) return null;
  const query = new URLSearchParams({
    dlat: String(coordinates.latitude),
    dlng: String(coordinates.longitude),
    dname: `${destination.name} (${destination.address})`,
    appname: pageUrl,
  });
  return `nmap://route/public?${query.toString()}`;
}

export function getNaverMapSearchUrl(name: string, region: string): string | null {
  if (!name.trim() || !region.trim()) return null;
  return `https://map.naver.com/p/search/${encodeURIComponent(`${region.trim()} ${name.trim()}`)}`;
}

export type RoutePoint = { latitude: number; longitude: number };

export function isUsableLocationAccuracy(accuracy: number): boolean {
  return Number.isFinite(accuracy) && accuracy > 0 && accuracy <= 1000;
}

// Observed in NAVER's shared web URLs and public web client (2026-11-08).
// This is not a documented external API contract.
function encodeWebCoordinate(value: number): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let integer = Math.round(value * 10_000_000) + 2_000_000_000;
  let encoded = "";
  do {
    encoded = alphabet[integer % 62] + encoded;
    integer = Math.floor(integer / 62);
  } while (integer > 0);
  return encoded;
}

export function getNaverWebDirectionsUrl(origin: RoutePoint, destination: MapDestination): string | null {
  const goal = getCoordinates(destination);
  if (!goal || !Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude) ||
    origin.latitude < -90 || origin.latitude > 90 || origin.longitude < -180 || origin.longitude > 180) return null;
  const point = (coordinates: RoutePoint, name: string) =>
    `${encodeWebCoordinate(coordinates.longitude)},${encodeWebCoordinate(coordinates.latitude)},${encodeURIComponent(name.replace(/,/g, "©"))},,SIMPLE_POI`;
  return `https://map.naver.com/p/directions/${point(origin, "현재 위치")}/${point(goal, destination.name)}/-/transit`;
}
