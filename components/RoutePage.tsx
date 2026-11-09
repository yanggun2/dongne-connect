import { getNeighborhoodOptions } from "@/lib/server/seongnam-centers";
import type { PageView } from "@/lib/navigation";
import { DongneApp } from "./DongneApp";

export type PageQuery = Promise<Record<string, string | string[] | undefined>>;

export async function RoutePage({ view, searchParams }: { view: PageView; searchParams: PageQuery }) {
  const query = await searchParams;
  const locations = getNeighborhoodOptions();
  const requested = query.neighborhood;
  const neighborhood = typeof requested === "string" && locations.some((item) => item.id === requested) ? requested : "citywide";
  const question = typeof query.question === "string" ? query.question.slice(0, 500) : "";
  return <DongneApp view={view} initialLocations={locations} initialNeighborhood={neighborhood} initialQuestion={question} />;
}
