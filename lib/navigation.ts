export type PageView = "home" | "life" | "facilities" | "waste" | "map" | "news" | "notices" | "events" | "calendar" | "community";

export function pageLink(path: string, neighborhood = "citywide", question?: string): string {
  const query = new URLSearchParams();
  if (neighborhood !== "citywide") query.set("neighborhood", neighborhood);
  if (question) query.set("question", question);
  return path + (query.size ? `?${query}` : "");
}

export function mainSection(view: PageView): "home" | "life" | "news" | "community" {
  if (["life", "facilities", "waste", "map"].includes(view)) return "life";
  if (["news", "notices", "events", "calendar"].includes(view)) return "news";
  return view === "community" ? "community" : "home";
}
