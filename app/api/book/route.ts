import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const NL_KEY = process.env.NL_CERT_KEY;

type Normalized = {
  found: boolean;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  cover: string;
  description: string;
};

function normalizeIsbn(raw: string): string {
  let s = (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (s.length > 13) s = s.slice(0, 13);
  return s;
}

async function lookupKakao(isbn: string): Promise<Normalized | null> {
  if (!KAKAO_KEY) return null;
  const url =
    "https://dapi.kakao.com/v3/search/book?target=isbn&query=" +
    encodeURIComponent(isbn);
  const r = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    cache: "no-store",
  });
  if (r.status === 429) throw new Error("rate_limited"); // 카카오 일일/월간 쿼터 초과
  if (!r.ok) return null;
  const data = await r.json();
  const doc = data?.documents?.[0];
  if (!doc) return null;
  return {
    found: true,
    isbn,
    title: doc.title || "",
    author: (doc.authors || []).join(", "),
    publisher: doc.publisher || "",
    pubDate: (doc.datetime || "").slice(0, 10),
    cover: doc.thumbnail || "",
    description: doc.contents || "",
  };
}

async function lookupNL(isbn: string): Promise<Normalized | null> {
  if (!NL_KEY) return null;
  const url =
    "https://www.nl.go.kr/seoji/SearchApi.do?cert_key=" +
    NL_KEY +
    "&result_style=json&page_no=1&page_size=1&isbn=" +
    encodeURIComponent(isbn);
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json();
  const doc = data?.docs?.[0];
  if (!doc) return null;
  const cover = String(doc.TITLE_URL || "").replace(/^http:/, "https:");
  return {
    found: true,
    isbn,
    title: doc.TITLE || "",
    author: doc.AUTHOR || "",
    publisher: doc.PUBLISHER || "",
    pubDate: doc.PUBLISH_PREDATE || "",
    cover,
    description: "",
  };
}

export async function GET(req: NextRequest) {
  if (!KAKAO_KEY && !NL_KEY) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 500 });
  }
  const isbn = normalizeIsbn(req.nextUrl.searchParams.get("isbn") || "");
  if (isbn.length < 10) {
    return NextResponse.json({ error: "invalid_isbn" }, { status: 400 });
  }
  try {
    let result: Normalized | null = null;
    let rateLimited = false;
    try {
      result = await lookupKakao(isbn);
    } catch (e: any) {
      if (e?.message === "rate_limited") rateLimited = true; // 카카오 쿼터 초과 → NL 폴백 시도
    }
    if (!result) result = await lookupNL(isbn);
    if (result) return NextResponse.json(result);
    if (rateLimited)
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    return NextResponse.json({ found: false, isbn });
  } catch {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
