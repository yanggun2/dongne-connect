import { getCenterMapDestination } from "./center-map-reference";
import { getCoordinates, type MapDestination } from "./map-links";

type Center = { id: string; centerName: string; address: string };
const pending = new Map<string, Promise<MapDestination | undefined>>();

// Deduplicate within this page, including the search-result and home maps.
export function resolveCenterLocation(center: Center): Promise<MapDestination | undefined> {
  const known = getCenterMapDestination(center);
  if (known) return Promise.resolve(known);
  const key = JSON.stringify([center.id, center.centerName, center.address]);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = fetch(`/api/center-location?id=${encodeURIComponent(center.id)}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const { destination } = await response.json();
      if (!destination || destination.name !== center.centerName || destination.address !== center.address ||
        typeof destination.latitude !== "string" || typeof destination.longitude !== "string" || !getCoordinates(destination)) return undefined;
      return destination as MapDestination;
    }).catch(() => undefined)
    .then((destination) => { if (!destination) pending.delete(key); return destination; });
  pending.set(key, request);
  return request;
}
