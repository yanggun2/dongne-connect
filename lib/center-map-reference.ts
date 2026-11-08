import type { MapDestination } from "./map-links";

// User-provided NAVER share link: https://naver.me/5eD2AE03
// Coordinates decoded from the actual redirect on 2026-11-08; not from the CSV.
// Name/address cross-check: https://www.eshare.go.kr/UserPortal/Upv/UprResrcExpr/index.do?rsrc_no=BA10A0001968
const eunhaengCenter = {
  id: "중원구|은행1동",
  name: "은행1동행정복지센터",
  address: "경기도 성남시 중원구 은행로 85 (은행동)",
  latitude: "37.4521125",
  longitude: "127.1689061",
};

export function getCenterMapDestination(center: {
  id: string; centerName: string; address: string;
}): MapDestination | undefined {
  if (center.id !== eunhaengCenter.id || center.centerName !== eunhaengCenter.name ||
    center.address !== eunhaengCenter.address) return undefined;
  return eunhaengCenter;
}
