import { NextResponse } from "next/server";
import { getNeighborhoodOptions } from "@/lib/server/seongnam-centers";

export const runtime = "nodejs";
export const revalidate = 3_600;

export async function GET() {
  return NextResponse.json(
    { locations: getNeighborhoodOptions() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
