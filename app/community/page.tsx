import type { Metadata } from "next";
import { RoutePage, type PageQuery } from "@/components/RoutePage";

export const metadata: Metadata = { title: "커뮤니티 | 동네일" };

export default function Page({ searchParams }: { searchParams: PageQuery }) {
  return <RoutePage view="community" searchParams={searchParams} />;
}
