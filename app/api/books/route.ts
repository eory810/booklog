import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 내 서재에 저장된 책 목록
export async function GET() {
  const { rows } = await query(
    `select isbn, title, author, publisher, pub_date, cover, added_at
       from books
      order by added_at desc`
  );
  return NextResponse.json(rows);
}

// 책 추가 / 수정 (ISBN 기준 upsert → 중복 스캔은 자동으로 갱신)
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.isbn) {
    return NextResponse.json({ error: "isbn_required" }, { status: 400 });
  }
  const { rows } = await query(
    `insert into books (isbn, title, author, publisher, pub_date, cover, description)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (isbn) do update set
       title       = excluded.title,
       author      = excluded.author,
       publisher   = excluded.publisher,
       pub_date    = excluded.pub_date,
       cover       = excluded.cover,
       description = excluded.description
     returning isbn, title, author, publisher, pub_date, cover, added_at`,
    [
      b.isbn,
      b.title || "",
      b.author || "",
      b.publisher || "",
      b.pubDate || "",
      b.cover || "",
      b.description || "",
    ]
  );
  return NextResponse.json(rows[0]);
}

// 책 삭제
export async function DELETE(req: NextRequest) {
  const isbn = req.nextUrl.searchParams.get("isbn");
  if (!isbn) {
    return NextResponse.json({ error: "isbn_required" }, { status: 400 });
  }
  await query("delete from books where isbn = $1", [isbn]);
  return NextResponse.json({ ok: true });
}