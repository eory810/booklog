import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

export const runtime = "nodejs";

// 앱에서도 부를 수 있게 CORS 허용
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function shortId(n = 10) {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (let i = 0; i < n; i++) s += c[arr[i] % c.length];
  return s;
}

const MAX_BOOKS = 400;

// 공유 스냅샷 만들기
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_body" }, 400);
  }
  const books = Array.isArray(body?.books) ? body.books : null;
  if (!books || !books.length) return json({ error: "empty" }, 400);

  // 공개 필드만 저장 (메모·대출 등 사적 정보 제외)
  const clean = books.slice(0, MAX_BOOKS).map((b: any) => ({
    isbn: String(b.isbn || ""),
    title: String(b.title || ""),
    author: String(b.author || ""),
    publisher: String(b.publisher || ""),
    pubDate: String(b.pubDate || b.pub_date || ""),
    cover: String(b.cover || ""),
    status: b.status === "reading" || b.status === "read" ? b.status : "unread",
    category: String(b.category || ""),
    rating: Number(b.rating) || 0,
  }));

  const snapshot = {
    v: 1,
    createdAt: new Date().toISOString(),
    theme: ["wood", "white", "dark", "pastel"].includes(body?.theme) ? body.theme : "wood",
    name: String(body?.name || "").slice(0, 30),
    books: clean,
  };

  try {
    const store = getStore("shelves");
    const id = shortId();
    await store.setJSON(id, snapshot);
    return json({ id });
  } catch {
    return json({ error: "store_error" }, 502);
  }
}

// id 로 스냅샷 읽기
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^[a-z0-9]{6,16}$/.test(id)) return json({ error: "bad_id" }, 400);
  try {
    const store = getStore("shelves");
    const data = await store.get(id, { type: "json" });
    if (!data) return json({ error: "not_found" }, 404);
    return json(data);
  } catch {
    return json({ error: "store_error" }, 502);
  }
}
