import type { Metadata } from "next";
import "./globals.css";
import "./home.css";
import "./redesign.css";

export const metadata: Metadata = {
  title: "동네일 | 우리 동네 생활정보",
  description: "우리 동네 생활정보를 질문 하나로 찾아보는 동네일",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
