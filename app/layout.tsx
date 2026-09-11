import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 서재 📚 — 우리집 책 스캔",
  description: "바코드를 스캔해 우리집 책을 디지털 서재로 정리하세요.",
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
