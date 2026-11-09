import type { Metadata } from "next";
import { RoutePage, type PageQuery } from "@/components/RoutePage";

export const metadata: Metadata = { title: "공공시설 | 동네일" };

export default function Page({ searchParams }: { searchParams: PageQuery }) {
  return <RoutePage view="facilities" searchParams={searchParams} />;
}
