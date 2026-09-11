import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 서재 — 바코드 스캔",
  description: "바코드를 스캔해 책을 서재에 저장하고 목록으로 관리합니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
