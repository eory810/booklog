import type { Metadata, Viewport } from "next";

// 배포 주소가 바뀌면 이 URL도 바꿔주세요.
const SITE_URL = "https://book-scan-library.netlify.app";
const APP_NAME = "리베르홈 📚 — 우리집 책 스캔";
const APP_DESC =
  "집에 어떤 책이 있는지 스캔 한 번으로 정리하세요. 중복 구매 방지, 표지 책장, 대출 기록까지 — 로그인 없이.";

const FONT_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

// 📚 이모지 파비콘 (별도 이미지 파일 없이)
const EMOJI_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>'
  );

// 첫 화면부터 배경·폰트·기본 틀이 잡히도록 하는 핵심 CSS (FOUC 방지)
const CRITICAL_CSS = `
:root{--green:#1fa45b;--green-deep:#157a42;--green-soft:#e7f5ec;--ink:#1c2420;--sub:#69756d;--line:#e5e9e6;--bg:#fafbfa;--gold:#d9930d;--sans:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;}
html{background:#fafbfa;}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.6;-webkit-font-smoothing:antialiased;word-break:keep-all;}
.app{max-width:880px;margin:0 auto;padding:0 18px 90px;}
.top{display:flex;align-items:center;justify-content:space-between;padding:16px 0;flex-wrap:wrap;gap:10px;}
.brand{display:flex;align-items:center;gap:8px;font-size:22px;font-weight:900;letter-spacing:-0.02em;}
.scanbar{display:flex;align-items:center;gap:10px;background:var(--green);border-radius:16px;padding:14px 14px 14px 18px;box-shadow:0 14px 30px -14px rgba(31,164,91,0.6);}
.scan{flex:1;min-width:0;background:none;border:none;outline:none;color:#fff;font-size:18px;font-weight:600;}
.wrap{max-width:880px;margin:0 auto;padding:0 18px 60px;}
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: APP_DESC,
  applicationName: "리베르홈",
  icons: { icon: EMOJI_ICON },
  openGraph: {
    title: APP_NAME,
    description: APP_DESC,
    type: "website",
    locale: "ko_KR",
    siteName: "리베르홈",
  },
  twitter: { card: "summary", title: APP_NAME, description: APP_DESC },
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
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href={FONT_CSS} />
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
