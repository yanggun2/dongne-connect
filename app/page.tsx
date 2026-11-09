import type { Metadata } from "next";
import { RoutePage, type PageQuery } from "@/components/RoutePage";

export const metadata: Metadata = { title: "동네일 | 우리 동네 생활정보" };

export default function Page({ searchParams }: { searchParams: PageQuery }) {
  return <RoutePage view="home" searchParams={searchParams} />;
}
