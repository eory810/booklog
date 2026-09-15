"use client";

import { useState } from "react";

type B = { isbn: string; title: string; cover: string };

export default function Compare({ shared }: { shared: B[] }) {
  const [result, setResult] = useState<
    null | { overlap: B[]; onlyShared: B[]; myCount: number }
  >(null);
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
    const overlap = shared.filter((b) => myset.has(b.isbn));
    const onlyShared = shared.filter((b) => !myset.has(b.isbn));
    setNoLib(false);
    setResult({ overlap, onlyShared, myCount: mine.length });
  }

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
              <div className="cmp-row">
                {result.overlap.slice(0, 30).map((b, i) => (
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
            </>
          )}

          {result.onlyShared.length > 0 && (
            <>
              <h3 className="cmp-h">✨ 나에겐 없는 책 (구경해보세요)</h3>
              <div className="cmp-row">
                {result.onlyShared.slice(0, 30).map((b, i) => (
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
