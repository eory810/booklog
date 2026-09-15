import { getStore } from "@netlify/blobs";
import type { Metadata } from "next";
import Compare from "./Compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareBook = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  cover: string;
  status: "unread" | "reading" | "read";
  category: string;
  rating: number;
};
type Shelf = {
  v: number;
  createdAt: string;
  theme: "wood" | "white" | "dark" | "pastel";
  name: string;
  books: ShareBook[];
};

const THEME: Record<string, { bg1: string; bg2: string; board: string; border: string }> = {
  wood: { bg1: "#fbf7ef", bg2: "#f5ecdd", board: "#d6bd88", border: "#ece1cc" },
  white: { bg1: "#ffffff", bg2: "#f3f6f3", board: "#d3d8d3", border: "#e5e9e6" },
  dark: { bg1: "#2c2824", bg2: "#211e1a", board: "#3b3123", border: "#3a342c" },
  pastel: { bg1: "#eef7f0", bg2: "#e2efe7", board: "#bcdcc6", border: "#d5e8db" },
};

const PALETTE = ["#E8F0FB", "#E7F5EC", "#F0EAFB", "#FBEDE5", "#FCF3DF", "#FAE9E9", "#E4F5F2", "#FBEAF2"];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

async function load(id: string): Promise<Shelf | null> {
  if (!/^[a-z0-9]{6,16}$/.test(id)) return null;
  try {
    const store = getStore("shelves");
    const data = (await store.get(id, { type: "json" })) as Shelf | null;
    return data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shelf = await load(id);
  const count = shelf?.books?.length || 0;
  const who = shelf?.name ? `${shelf.name}님의 ` : "";
  const title = shelf ? `${who}책장 📚 (${count}권)` : "책장을 찾을 수 없어요";
  const description = shelf
    ? "'내 서재'로 공유된 책장이에요. 눌러서 구경해보세요."
    : "링크가 만료되었거나 잘못되었어요.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "ko_KR" },
    twitter: { card: "summary", title, description },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shelf = await load(id);

  if (!shelf) {
    return (
      <main style={{ fontFamily: "sans-serif", textAlign: "center", padding: "80px 20px", color: "#69756d" }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h1 style={{ fontSize: 22, color: "#25221b", margin: "12px 0 6px" }}>책장을 찾을 수 없어요</h1>
        <p>링크가 만료되었거나 잘못된 주소예요.</p>
        <a href="/" style={{ color: "#157a42", fontWeight: 700 }}>내 서재 만들러 가기 →</a>
      </main>
    );
  }

  const t = THEME[shelf.theme] || THEME.wood;
  const who = shelf.name ? `${shelf.name}님의 책장` : "공유된 책장";

  return (
    <main className="wrap">
      <header className="head">
        <div className="brand">📚 {who}</div>
        <div className="count">{shelf.books.length}권</div>
      </header>

      <section className="shelf">
        {shelf.books.map((b, i) => {
          const pastel = PALETTE[hash(b.isbn || String(i)) % PALETTE.length];
          const tilt = (hash(b.isbn || String(i)) % 5) - 2;
          return (
            <div className="bw" key={b.isbn || i}>
              <div className="book" style={{ transform: `rotate(${tilt}deg)` }}>
                {b.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover} alt={b.title} />
                ) : (
                  <div className="blank" style={{ background: pastel }}>
                    <span>{b.title || "제목 미확인"}</span>
                  </div>
                )}
                {b.status === "read" && <span className="badge">✓</span>}
              </div>
            </div>
          );
        })}
      </section>

      <Compare shared={shelf.books.map((b) => ({ isbn: b.isbn, title: b.title, cover: b.cover }))} />

      <a className="cta" href="/">나도 내 책장 만들기 →</a>

      <style>{`
        :root { --sans: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#fafbfa; font-family:var(--sans); color:#25221b; -webkit-font-smoothing:antialiased; }
        .wrap { max-width:880px; margin:0 auto; padding:0 18px 60px; }
        .head { display:flex; align-items:center; justify-content:space-between; padding:24px 2px 16px; }
        .brand { font-size:22px; font-weight:900; letter-spacing:-0.02em; word-break:keep-all; }
        .count { font-size:14px; font-weight:800; color:#157a42; background:#e7f5ec; border-radius:20px; padding:4px 12px; }
        .shelf {
          display:flex; flex-wrap:wrap; align-items:flex-end; gap:0 14px;
          background:linear-gradient(${t.bg1}, ${t.bg2});
          border:1px solid ${t.border}; border-radius:16px; padding:22px 18px 0;
          background-image:repeating-linear-gradient(to bottom, transparent 0, transparent 134px, ${t.board} 134px, ${t.board} 148px);
          background-size:100% 148px;
        }
        .bw { height:148px; display:flex; align-items:flex-end; padding-bottom:14px; }
        .book { position:relative; width:80px; height:114px; border-radius:2px 5px 5px 2px; overflow:hidden; box-shadow:3px 5px 9px rgba(40,30,12,0.22); }
        .book::before { content:""; position:absolute; top:0; bottom:0; left:0; width:5px; z-index:2; background:linear-gradient(90deg, rgba(0,0,0,0.28), rgba(0,0,0,0)); }
        .book img { width:100%; height:100%; object-fit:cover; display:block; }
        .blank { width:100%; height:100%; display:flex; align-items:center; justify-content:center; text-align:center; padding:8px; }
        .blank span { font-size:11.5px; font-weight:800; color:#2b2b2b; line-height:1.25; word-break:keep-all;
          display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
        .badge { position:absolute; top:4px; right:4px; z-index:3; font-size:11px; background:rgba(255,255,255,0.92); border-radius:20px; padding:1px 5px; }
        .cta { display:block; text-align:center; margin:26px auto 0; max-width:320px; background:#1fa45b; color:#fff;
          font-size:15px; font-weight:800; text-decoration:none; border-radius:12px; padding:14px; }

        .cmp { margin-top:26px; text-align:center; }
        .cmp-btn { background:#e7f5ec; color:#157a42; font-size:14px; font-weight:800; border:none; cursor:pointer;
          border-radius:12px; padding:12px 20px; font-family:var(--sans); }
        .cmp-btn:hover { background:#d6efdf; }
        .cmp-none { margin-top:14px; font-size:13.5px; color:#69756d; }
        .cmp-none a { color:#157a42; font-weight:700; }
        .cmp-result { margin-top:18px; text-align:left; background:#fff; border:1px solid #e5e9e6; border-radius:16px; padding:18px; }
        .cmp-summary { display:flex; gap:12px; }
        .cmp-stat { flex:1; background:#f6f9f7; border-radius:12px; padding:14px; text-align:center; }
        .cmp-stat b { display:block; font-size:26px; font-weight:900; color:#157a42; line-height:1; }
        .cmp-stat span { font-size:12.5px; color:#69756d; }
        .cmp-h { font-size:14px; font-weight:800; margin:18px 0 10px; }
        .cmp-row { display:flex; flex-wrap:wrap; gap:8px; }
        .cmp-cover { width:52px; height:74px; border-radius:4px; overflow:hidden; background:#eef1ee; flex:none;
          display:flex; align-items:center; justify-content:center; }
        .cmp-cover img { width:100%; height:100%; object-fit:cover; }
        .cmp-blank { font-size:9px; font-weight:700; color:#69756d; padding:4px; text-align:center; line-height:1.2;
          display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
        @media (max-width:620px) {
          .shelf { gap:0 12px; padding:18px 14px 0;
            background-image:repeating-linear-gradient(to bottom, transparent 0, transparent 118px, ${t.board} 118px, ${t.board} 131px);
            background-size:100% 131px; }
          .bw { height:131px; padding-bottom:13px; }
          .book { width:68px; height:98px; }
        }
      `}</style>
    </main>
  );
}
