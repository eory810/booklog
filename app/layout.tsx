import type { Metadata, Viewport } from "next";

// 배포 주소가 바뀌면(넷리파이 서브도메인 변경 등) 이 URL도 바꿔주세요.
const SITE_URL = "https://book-scan-library.netlify.app/";
const APP_NAME = "내 서재 📚 — 우리집 책 스캔";
const APP_DESC =
  "집에 어떤 책이 있는지 스캔 한 번으로 정리하세요. 중복 구매 방지, 표지 책장, 대출 기록까지 — 로그인 없이.";

// 📚 이모지 파비콘 (별도 이미지 파일 없이)
const EMOJI_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>'
  );

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: APP_DESC,
  applicationName: "내 서재",
  icons: { icon: EMOJI_ICON },
  openGraph: {
    title: APP_NAME,
    description: APP_DESC,
    type: "website",
    locale: "ko_KR",
    siteName: "내 서재",
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: "#1fa45b",
  width: "device-width",
  initialScale: 1,
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
