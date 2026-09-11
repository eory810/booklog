"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Book = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pub_date: string;
  cover: string;
  added_at?: string;
};

function cleanIsbn(raw: string): string {
  let s = (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (s.length > 13) s = s.slice(0, 13);
  return s;
}

export default function Page() {
  const [books, setBooks] = useState<Book[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; warn?: boolean } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);

  const flash = useCallback((msg: string, warn = false) => {
    setToast({ msg, warn });
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refocus = useCallback(() => {
    if (!editingRef.current) scanRef.current?.focus();
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/books", { cache: "no-store" });
      if (r.ok) setBooks(await r.json());
    } catch {
      /* DB 미설정 등 — 조용히 빈 목록 유지 */
    }
  }, []);

  useEffect(() => {
    load();
    refocus();
  }, [load, refocus]);

  async function handleScan(raw: string) {
    const isbn = cleanIsbn(raw);
    if (scanRef.current) scanRef.current.value = "";
    if (isbn.length < 10) {
      if (isbn) flash("바코드를 다시 읽어주세요", true);
      refocus();
      return;
    }
    if (books.some((b) => b.isbn === isbn)) {
      flash("이미 서재에 있는 책이에요", true);
      refocus();
      return;
    }

    setBusy(true);
    try {
      const r = await fetch(`/api/book?isbn=${encodeURIComponent(isbn)}`, {
        cache: "no-store",
      });
      const info = await r.json();

      const book: Book = {
        isbn,
        title: info?.found ? info.title : "",
        author: info?.found ? info.author : "",
        publisher: info?.found ? info.publisher : "",
        pub_date: info?.found ? info.pubDate : "",
        cover: info?.found ? info.cover : "",
      };

      await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn: book.isbn,
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          pubDate: book.pub_date,
          cover: book.cover,
          description: info?.description || "",
        }),
      });

      setBooks((prev) => [book, ...prev]);
      if (info?.found && info.title) flash(`추가됨 · ${info.title}`);
      else flash("정보를 못 찾았어요 — 제목을 직접 입력하세요", true);
    } catch {
      flash("조회 중 오류가 났어요", true);
    } finally {
      setBusy(false);
      refocus();
    }
  }

  async function saveTitle(isbn: string, title: string) {
    const b = books.find((x) => x.isbn === isbn);
    if (!b) return;
    setBooks((prev) => prev.map((x) => (x.isbn === isbn ? { ...x, title } : x)));
    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isbn: b.isbn,
        title,
        author: b.author,
        publisher: b.publisher,
        pubDate: b.pub_date,
        cover: b.cover,
      }),
    });
  }

  async function remove(isbn: string) {
    setBooks((prev) => prev.filter((b) => b.isbn !== isbn));
    await fetch(`/api/books?isbn=${encodeURIComponent(isbn)}`, { method: "DELETE" });
    refocus();
  }

  function exportCsv() {
    if (!books.length) return flash("내보낼 책이 없어요", true);
    const head = ["ISBN", "제목", "저자", "출판사", "출판일"];
    const rows = books.map((b) =>
      [b.isbn, b.title, b.author, b.publisher, b.pub_date]
        .map((f) => `"${String(f || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob(["\uFEFF" + head.join(",") + "\n" + rows.join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "내서재.csv";
    a.click();
  }

  return (
    <main className="wrap">
      <header>
        <div className="title">
          내 서재<span className="dot">.</span>
        </div>
        <div className="head-right">
          <div className="count">
            <b>{books.length}</b>권
          </div>
          <button className="export" onClick={exportCsv}>
            CSV
          </button>
        </div>
      </header>

      <div className={`scanbar${busy ? " busy" : ""}`}>
        <div className="beam" />
        <input
          ref={scanRef}
          className="scan"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder="바코드를 스캔하거나 ISBN을 입력하세요"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleScan((e.target as HTMLInputElement).value);
            }
          }}
        />
      </div>
      <p className="hint">
        스캐너로 책 뒷면 바코드를 찍으면 자동으로 추가돼요. 제목을 눌러 고칠 수 있어요.
      </p>

      <div className="ledger">
        {books.length === 0 ? (
          <div className="empty">
            <div className="mark">❧</div>
            <div className="big">아직 등록된 책이 없어요</div>
            <p>위 입력창에 바코드를 스캔하면 여기에 쌓입니다.</p>
          </div>
        ) : (
          books.map((b) => (
            <div className="row" key={b.isbn}>
              <div className="cover">
                {b.cover ? (
                  // 카카오/국립중앙도서관 이미지 도메인 → next/image 설정 없이 plain img 사용
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover} alt="" />
                ) : (
                  <div className="spine" />
                )}
              </div>
              <div className="meta">
                <div
                  className={`bk-title${b.title ? "" : " unknown"}`}
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={() => (editingRef.current = true)}
                  onBlur={(e) => {
                    editingRef.current = false;
                    saveTitle(b.isbn, e.currentTarget.textContent?.trim() || "");
                    refocus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLElement).blur();
                    }
                  }}
                >
                  {b.title || "제목 미확인 — 눌러서 입력"}
                </div>
                <div className="bk-sub">
                  {[b.author, b.publisher, (b.pub_date || "").slice(0, 4)]
                    .filter(Boolean)
                    .map((s, i, arr) => (
                      <span key={i}>
                        {s}
                        {i < arr.length - 1 && <span className="sep">·</span>}
                      </span>
                    ))}
                </div>
                <div className="bk-isbn">ISBN {b.isbn}</div>
              </div>
              <button className="del" title="삭제" onClick={() => remove(b.isbn)}>
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {toast && <div className={`toast show${toast.warn ? " warn" : ""}`}>{toast.msg}</div>}

      <style jsx global>{`
        :root {
          --paper: #f4f1e8;
          --paper-2: #ece7d9;
          --ink: #25221b;
          --ink-soft: #6b6455;
          --green: #1f3d2f;
          --green-2: #2c5240;
          --brass: #a8763e;
          --brass-soft: #c9a878;
          --ribbon: #8a3b32;
          --line: #d8d1bf;
          --serif: Georgia, "Nanum Myeongjo", "Batang", serif;
          --sans: "Pretendard", -apple-system, "Apple SD Gothic Neo",
            "Malgun Gothic", sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--paper); color: var(--ink); font-family: var(--sans); }
      `}</style>
      <style jsx>{`
        .wrap { max-width: 760px; margin: 0 auto; padding: 0 20px 80px; }
        header {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; padding: 32px 0 22px;
        }
        .title { font-family: var(--serif); font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
        .title .dot { color: var(--brass); }
        .head-right { display: flex; align-items: center; gap: 14px; }
        .count { font-family: var(--serif); font-size: 15px; color: var(--ink-soft);
          border-bottom: 2px solid var(--brass-soft); padding-bottom: 1px; }
        .count b { color: var(--green); font-size: 19px; }
        .export { background: none; border: 1px solid var(--line); color: var(--ink-soft);
          font-size: 13px; padding: 6px 12px; border-radius: 2px; cursor: pointer; transition: 0.15s; }
        .export:hover { border-color: var(--brass); color: var(--green); }
        .scanbar { display: flex; align-items: center; gap: 14px; background: var(--green);
          border-radius: 4px; padding: 20px 22px; box-shadow: 0 8px 24px -12px rgba(31, 61, 47, 0.55); }
        .scanbar.busy { opacity: 0.85; }
        .beam { width: 14px; height: 34px; border-radius: 2px; flex: none;
          background: linear-gradient(var(--brass-soft), var(--brass)); animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        .scan { flex: 1; background: none; border: none; outline: none; color: var(--paper);
          font-family: var(--serif); font-size: 20px; }
        .scan::placeholder { color: rgba(244, 241, 232, 0.5); }
        .hint { font-size: 13px; color: var(--ink-soft); padding: 12px 4px 20px; }
        .ledger { margin-top: 8px; }
        .row { display: flex; gap: 16px; align-items: flex-start; padding: 16px 4px;
          border-top: 1px solid var(--line); animation: land 0.4s ease both; }
        .row:first-child { border-top: none; }
        @keyframes land { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        .cover { width: 52px; height: 74px; flex: none; border-radius: 2px; overflow: hidden;
          background: var(--paper-2); border: 1px solid var(--line); display: flex;
          align-items: center; justify-content: center; }
        .cover :global(img) { width: 100%; height: 100%; object-fit: cover; }
        .spine { width: 100%; height: 100%; background: linear-gradient(135deg, var(--green), var(--green-2)); }
        .meta { flex: 1; min-width: 0; }
        .bk-title { font-family: var(--serif); font-size: 18px; font-weight: 600; color: var(--ink);
          line-height: 1.35; word-break: keep-all; outline: none; border-radius: 2px; }
        .bk-title:focus { background: #fff; box-shadow: 0 0 0 2px var(--brass-soft); }
        .bk-title.unknown { color: var(--ink-soft); font-style: italic; font-weight: 400; }
        .bk-sub { font-size: 13.5px; color: var(--ink-soft); margin-top: 3px; }
        .bk-sub .sep { color: var(--brass-soft); margin: 0 6px; }
        .bk-isbn { font-size: 12px; color: var(--ink-soft); opacity: 0.75; margin-top: 5px; }
        .del { flex: none; background: none; border: none; cursor: pointer; color: var(--ink-soft);
          font-size: 20px; line-height: 1; padding: 4px 6px; border-radius: 3px; transition: 0.15s; opacity: 0.5; }
        .row:hover .del { opacity: 1; }
        .del:hover { color: var(--ribbon); background: var(--paper-2); }
        .empty { text-align: center; padding: 60px 20px; color: var(--ink-soft); }
        .empty .mark { font-family: var(--serif); font-size: 44px; color: var(--brass-soft); margin-bottom: 12px; }
        .empty .big { font-family: var(--serif); font-size: 19px; color: var(--ink); margin-bottom: 6px; }
        .toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
          background: var(--green); color: var(--paper); padding: 11px 20px; border-radius: 4px;
          font-size: 14px; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4); z-index: 50; }
        .toast.warn { background: var(--ribbon); }
      `}</style>
    </main>
  );
}
