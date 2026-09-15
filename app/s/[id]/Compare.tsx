"use client";

import { useState } from "react";

type B = { isbn: string; title: string; author: string; category: string; cover: string };
type Pair = [string, number];

function topBy(list: any[], key: "author" | "category", n = 5): Pair[] {
  const count: Record<string, number> = {};
  for (const b of list) {
    const raw = (b?.[key] || "").toString().trim();
    if (!raw) continue;
    // 저자는 "홍길동, 김철수" 형태일 수 있어 첫 저자 기준
    const v = key === "author" ? raw.split(",")[0].trim() : raw;
    if (!v) continue;
    count[v] = (count[v] || 0) + 1;
  }
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export default function Compare({ shared }: { shared: B[] }) {
  const [result, setResult] = useState<null | {
    overlap: B[];
    onlyShared: B[];
    myAuthors: Pair[];
    theirAuthors: Pair[];
    myCats: Pair[];
    theirCats: Pair[];
  }>(null);
  const [noLib, setNoLib] = useState(false);

  function compare() {
    let mine: any[] = [];
    try {
      const v = localStorage.getItem("booklog:books");
      mine = v ? JSON.parse(v) : [];
    } catch {
      mine = [];
    }
    if (!mine.length) {
      setNoLib(true);
      setResult(null);
      return;
    }
    const myset = new Set(mine.map((b: any) => b.isbn));
    setNoLib(false);
    setResult({
      overlap: shared.filter((b) => myset.has(b.isbn)),
      onlyShared: shared.filter((b) => !myset.has(b.isbn)),
      myAuthors: topBy(mine, "author"),
      theirAuthors: topBy(shared, "author"),
      myCats: topBy(mine, "category"),
      theirCats: topBy(shared, "category"),
    });
  }

  const covers = (list: B[]) => (
    <div className="cmp-row">
      {list.slice(0, 30).map((b, i) => (
        <div className="cmp-cover" key={b.isbn || i} title={b.title}>
          {b.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.cover} alt={b.title} />
          ) : (
            <span className="cmp-blank">{b.title || "?"}</span>
          )}
        </div>
      ))}
    </div>
  );

  const rankList = (pairs: Pair[]) =>
    pairs.length ? (
      <ol className="cmp-rank">
        {pairs.map(([name, n]) => (
          <li key={name}>
            <span>{name}</span>
            <em>{n}</em>
          </li>
        ))}
      </ol>
    ) : (
      <p className="cmp-dim">데이터 없음</p>
    );

  return (
    <div className="cmp">
      <button className="cmp-btn" onClick={compare}>
        🔍 내 책장과 비교하기
      </button>

      {noLib && (
        <p className="cmp-none">
          이 기기에 저장된 내 서재가 없어요. 먼저 <a href="/">내 서재</a>를 만들면 비교할 수 있어요.
        </p>
      )}

      {result && (
        <div className="cmp-result">
          <div className="cmp-summary">
            <div className="cmp-stat">
              <b>{result.overlap.length}</b>
              <span>둘 다 있는 책</span>
            </div>
            <div className="cmp-stat">
              <b>{result.onlyShared.length}</b>
              <span>나에겐 없는 책</span>
            </div>
          </div>

          {result.overlap.length > 0 && (
            <>
              <h3 className="cmp-h">📚 둘 다 가진 책</h3>
              {covers(result.overlap)}
            </>
          )}

          {result.onlyShared.length > 0 && (
            <>
              <h3 className="cmp-h">✨ 나에겐 없는 책 (구경해보세요)</h3>
              {covers(result.onlyShared)}
            </>
          )}

          <h3 className="cmp-h">✍️ 많이 가진 저자</h3>
          <div className="cmp-cols">
            <div className="cmp-col">
              <div className="cmp-colhead them">상대</div>
              {rankList(result.theirAuthors)}
            </div>
            <div className="cmp-col">
              <div className="cmp-colhead me">나</div>
              {rankList(result.myAuthors)}
            </div>
          </div>

          {(result.theirCats.length > 0 || result.myCats.length > 0) && (
            <>
              <h3 className="cmp-h">🏷 분야 취향</h3>
              <div className="cmp-cols">
                <div className="cmp-col">
                  <div className="cmp-colhead them">상대</div>
                  {rankList(result.theirCats)}
                </div>
                <div className="cmp-col">
                  <div className="cmp-colhead me">나</div>
                  {rankList(result.myCats)}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
