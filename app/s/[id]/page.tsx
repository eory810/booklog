"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

/* ============================ 타입 & 상수 ============================ */

type Status = "unread" | "reading" | "read";

type Book = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  cover: string;
  description: string;
  addedAt: string;
  status: Status;
  rating: number; // 0~5
  memo: string;
  category: string; // 분야(자유 입력), "" = 미분류
  lentTo: string; // "" = 대출 안 함
};

type WishItem = {
  isbn: string;
  title: string;
  author: string;
  cover: string;
  addedAt: string;
};

const BOOKS_KEY = "booklog:books";
const WISH_KEY = "booklog:wishlist";

// 웹(넷리파이)에서는 빈 값 → 같은 주소의 /api/book 사용.
// 앱(Capacitor)에서는 .env.local 의 NEXT_PUBLIC_API_BASE 로 넷리파이 절대주소를 넣음.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const STATUS_LABEL: Record<Status, string> = {
  unread: "안 읽음",
  reading: "읽는 중",
  read: "읽음",
};

// 파스텔 책등 색 (배경 / 글자)
const PALETTE: { bg: string; ink: string }[] = [
  { bg: "#E8F0FB", ink: "#2D6FD2" },
  { bg: "#E7F5EC", ink: "#157A42" },
  { bg: "#F0EAFB", ink: "#7A4FD0" },
  { bg: "#FBEDE5", ink: "#E0662B" },
  { bg: "#FCF3DF", ink: "#8A6312" },
  { bg: "#FAE9E9", ink: "#D04545" },
  { bg: "#E4F5F2", ink: "#1AA391" },
  { bg: "#FBEAF2", ink: "#C74D86" },
];

/* ============================ 유틸 ============================ */

function cleanIsbn(raw: string): string {
  let s = (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (s.length > 13) s = s.slice(0, 13);
  return s;
}

// 진짜 책 ISBN인지 체크섬까지 검증 → 카메라 오독/부가기호(5자리) 등 걸러냄
function isbnValid(s: string): boolean {
  if (s.length === 13 && /^\d{13}$/.test(s) && (s.startsWith("978") || s.startsWith("979"))) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * Number(s[i]);
    return (10 - (sum % 10)) % 10 === Number(s[12]);
  }
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (10 - i) * Number(s[i]);
    sum += s[9] === "X" ? 10 : Number(s[9]);
    return sum % 11 === 0;
  }
  return false;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function colorFor(b: Book) {
  const key = b.category ? "c:" + b.category : "i:" + b.isbn;
  return PALETTE[hashStr(key) % PALETTE.length];
}

/* ============================ 저장소 ============================ */

function loadBooks(): Book[] {
  try {
    const v = localStorage.getItem(BOOKS_KEY);
    return v ? (JSON.parse(v) as Book[]) : [];
  } catch {
    return [];
  }
}
function loadWish(): WishItem[] {
  try {
    const v = localStorage.getItem(WISH_KEY);
    return v ? (JSON.parse(v) as WishItem[]) : [];
  } catch {
    return [];
  }
}

/* ============================ 카메라 스캐너 ============================ */

function CameraScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const [err, setErr] = useState("");
  const lastRef = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const streakRef = useRef<{ code: string; n: number }>({ code: "", n: 0 });

  useEffect(() => {
    let scanner: any = null;
    let cancelled = false;

    (async () => {
      try {
        const mod: any = await import("html5-qrcode");
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;
        scanner = new Html5Qrcode("reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
          ],
          verbose: false,
        });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 150 } },
          (decoded: string) => {
            const now = Date.now();
            // 1) 같은 코드가 연속 2번 잡혀야 인정 (한 프레임 오독 방지)
            if (decoded === streakRef.current.code) streakRef.current.n++;
            else streakRef.current = { code: decoded, n: 1 };
            if (streakRef.current.n < 2) return;
            // 2) 방금 처리한 코드가 2초 내 또 들어오면 무시 (중복 추가 방지)
            if (
              decoded === lastRef.current.code &&
              now - lastRef.current.t < 2000
            )
              return;
            lastRef.current = { code: decoded, t: now };
            streakRef.current = { code: "", n: 0 };
            onDetected(decoded);
          },
          () => {}
        );
      } catch (e: any) {
        if (!cancelled)
          setErr(
            "카메라를 열 수 없어요. 권한을 허용했는지, https 주소인지 확인해주세요."
          );
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [onDetected]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal cam" onClick={(e) => e.stopPropagation()}>
        <div className="cam-head">
          <b>📷 카메라로 스캔</b>
          <button className="cam-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="cam-stage">
          <div id="reader" className="reader" />
          <button className="cam-close-float" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
              stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        {err ? (
          <p className="cam-err">{err}</p>
        ) : (
          <p className="cam-tip">책 뒷면 바코드를 사각형 안에 비춰주세요.</p>
        )}
      </div>
    </div>
  );
}

/* ============================ 메인 ============================ */

export default function Page() {
  const [books, setBooks] = useState<Book[]>([]);
  const [wish, setWish] = useState<WishItem[]>([]);
  const [ready, setReady] = useState(false);

  const [tab, setTab] = useState<"library" | "wish" | "stats">("library");
  const [view, setView] = useState<"shelf" | "list">("shelf");
  const [quickMode, setQuickMode] = useState(false);
  const [shelfTheme, setShelfTheme] = useState<"wood" | "white" | "dark" | "pastel">("wood");
  const [themeOpen, setThemeOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [sort, setSort] = useState<"added" | "title" | "author">("added");

  const [selected, setSelected] = useState<Book | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [quickResult, setQuickResult] = useState<{
    owned: boolean;
    book?: Book;
    isbn: string;
    info?: any;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; warn?: boolean } | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [isApp, setIsApp] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);

  /* --- 로드 & 저장 --- */
  useEffect(() => {
    setBooks(loadBooks());
    setWish(loadWish());
    setReady(true);
    try {
      const cap = (window as any).Capacitor;
      if (cap?.isNativePlatform?.()) setIsApp(true);
      if (!localStorage.getItem("booklog:seen")) setShowIntro(true);
      const t = localStorage.getItem("booklog:shelftheme");
      if (t === "wood" || t === "white" || t === "dark" || t === "pastel") setShelfTheme(t);
    } catch {}
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  }, [books, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(WISH_KEY, JSON.stringify(wish));
  }, [wish, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem("booklog:shelftheme", shelfTheme);
  }, [shelfTheme, ready]);

  const flash = useCallback((msg: string, warn = false) => {
    setToast({ msg, warn });
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refocus = useCallback(() => {
    // 폰(터치)에서는 자동 포커스 금지 → 숫자 키보드가 저절로 뜨지 않게.
    // 검색창을 직접 눌렀을 때만 키보드가 뜸. USB 스캐너를 쓰는 데스크톱만 자동 포커스.
    if (typeof window !== "undefined" && !window.matchMedia("(pointer: fine)").matches)
      return;
    if (tab === "library" && !camOpen && !selected) scanRef.current?.focus();
  }, [tab, camOpen, selected]);

  useEffect(() => {
    refocus();
  }, [refocus]);

  /* --- 조회 --- */
  type LookupResult =
    | { status: "found"; info: any }
    | { status: "notfound" }
    | { status: "limited" }
    | { status: "error" };

  async function lookupApi(isbn: string): Promise<LookupResult> {
    try {
      const r = await fetch(`${API_BASE}/api/book?isbn=${encodeURIComponent(isbn)}`, {
        cache: "no-store",
      });
      if (r.status === 429) return { status: "limited" };
      const info = await r.json();
      if (info?.found) return { status: "found", info };
      if (info?.error === "rate_limited") return { status: "limited" };
      return { status: "notfound" };
    } catch {
      return { status: "error" };
    }
  }

  /* --- 스캔 처리 --- */
  async function handleScan(raw: string) {
    const isbn = cleanIsbn(raw);
    if (scanRef.current) scanRef.current.value = "";
    if (!isbnValid(isbn)) {
      // 부가기호(5자리)·카메라 오독 등 → 저장/오판 없이 무시
      if (isbn) flash("바코드를 다시 읽어주세요 (책 ISBN이 아니에요)", true);
      return;
    }
    const existing = books.find((b) => b.isbn === isbn);

    // 빠른 확인 모드: 추가하지 않고 소유 여부만
    if (quickMode) {
      if (existing) {
        setQuickResult({ owned: true, book: existing, isbn });
      } else {
        setBusy(true);
        const res = await lookupApi(isbn);
        setBusy(false);
        if (res.status === "limited") {
          flash("지금 조회량이 많아요 🙏 잠시 후 다시 시도해주세요", true);
          return;
        }
        setQuickResult({
          owned: false,
          isbn,
          info: res.status === "found" ? res.info : null,
        });
      }
      return;
    }

    // 등록 모드
    if (existing) {
      flash("이미 서재에 있는 책이에요", true);
      return;
    }
    setBusy(true);
    const res = await lookupApi(isbn);
    setBusy(false);
    if (res.status === "limited") {
      // 쿼터 초과 시엔 빈 책을 저장하지 않고 안내만
      flash("지금 조회량이 많아요 🙏 잠시 후 다시 시도해주세요", true);
      return;
    }
    const info = res.status === "found" ? res.info : null;
    const book: Book = {
      isbn,
      title: info?.title || "",
      author: info?.author || "",
      publisher: info?.publisher || "",
      pubDate: info?.pubDate || "",
      cover: info?.cover || "",
      description: info?.description || "",
      addedAt: new Date().toISOString(),
      status: "unread",
      rating: 0,
      memo: "",
      category: "",
      lentTo: "",
    };
    setBooks((prev) => [book, ...prev]);
    if (info?.title) flash(`추가됨 · ${info.title}`);
    else flash("정보를 못 찾았어요 — 책을 눌러 제목을 입력하세요", true);
  }

  // 카메라 버튼: 앱(Capacitor)에서는 네이티브 스캐너, 웹에서는 기존 방식
  async function openScanner() {
    const cap = (typeof window !== "undefined" ? (window as any).Capacitor : null);
    const native = !!cap?.isNativePlatform?.();
    const Scanner = cap?.Plugins?.BarcodeScanner;
    if (native && Scanner) {
      try {
        const perm = await Scanner.requestPermissions();
        const status = perm?.camera;
        if (status !== "granted" && status !== "limited") {
          flash("카메라 권한을 허용해주세요", true);
          return;
        }
        // 구글 바코드 스캐너 모듈이 준비됐는지 확인 (안 됐으면 설치 후 재시도 안내)
        try {
          const avail = await Scanner.isGoogleBarcodeScannerModuleAvailable?.();
          if (avail && avail.available === false) {
            await Scanner.installGoogleBarcodeScannerModule?.();
            flash("스캐너를 준비하고 있어요… 잠시 후 📷 를 다시 눌러주세요", true);
            return;
          }
        } catch {
          /* 이 API가 없는 버전이면 무시하고 바로 스캔 시도 */
        }
        const res = await Scanner.scan({ formats: ["EAN_13", "EAN_8", "UPC_A"] });
        const b = res?.barcodes?.[0];
        const code = b?.rawValue || b?.displayValue || "";
        if (code) handleScan(code);
      } catch (e: any) {
        // 실제 원인을 화면에 노출 (진단용)
        const msg = e?.message || e?.errorMessage || (typeof e === "string" ? e : "") || "알 수 없는 오류";
        flash("스캐너 오류: " + msg, true);
      }
      return;
    }
    // 웹: 기존 카메라 방식
    setCamOpen(true);
  }

  // 책장 공유: 스냅샷을 서버에 올리고 짧은 링크를 만들어 공유
  async function shareShelf() {
    if (!books.length) {
      flash("공유할 책이 없어요", true);
      return;
    }
    setBusy(true);
    try {
      // 사적 필드(메모·빌려준 사람)는 빼고 공개 필드만
      const shelf = books.map((b) => ({
        isbn: b.isbn,
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        pubDate: b.pubDate,
        cover: b.cover,
        status: b.status,
        category: b.category,
        rating: b.rating,
      }));
      const r = await fetch(`${API_BASE}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books: shelf, theme: shelfTheme }),
      });
      const data = await r.json();
      if (!data?.id) throw new Error("no id");
      const origin =
        API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
      const url = `${origin}/s/${data.id}`;
      const shareData = {
        title: "리베르홈",
        text: `내 책장을 구경해보세요 📚 (${books.length}권)`,
        url,
      };
      const cap = (typeof window !== "undefined" ? (window as any).Capacitor : null);
      const Share = cap?.Plugins?.Share;
      const isTouch =
        typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
      if (cap?.isNativePlatform?.() && Share) {
        await Share.share(shareData); // 앱: 폰 기본 공유창 (카톡 선택)
      } else if (isTouch && (navigator as any).share) {
        await (navigator as any).share(shareData); // 폰 웹: 네이티브 공유창
      } else {
        // PC: 어정쩡한 공유창 대신 링크 복사
        await navigator.clipboard.writeText(url);
        flash("공유 링크를 복사했어요 📋 카톡 등에 붙여넣기 하세요");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") flash("공유에 실패했어요. 잠시 후 다시 시도해주세요", true);
    } finally {
      setBusy(false);
    }
  }

  function addFromQuick() {
    if (!quickResult || quickResult.owned) return;
    const { isbn, info } = quickResult;
    const book: Book = {
      isbn,
      title: info?.title || "",
      author: info?.author || "",
      publisher: info?.publisher || "",
      pubDate: info?.pubDate || "",
      cover: info?.cover || "",
      description: info?.description || "",
      addedAt: new Date().toISOString(),
      status: "unread",
      rating: 0,
      memo: "",
      category: "",
      lentTo: "",
    };
    setBooks((prev) => [book, ...prev]);
    setQuickResult(null);
    flash("서재에 추가했어요");
  }

  function wishFromQuick() {
    if (!quickResult || quickResult.owned) return;
    const { isbn, info } = quickResult;
    if (wish.some((w) => w.isbn === isbn)) {
      flash("이미 위시리스트에 있어요", true);
      setQuickResult(null);
      return;
    }
    setWish((prev) => [
      {
        isbn,
        title: info?.title || "",
        author: info?.author || "",
        cover: info?.cover || "",
        addedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setQuickResult(null);
    flash("위시리스트에 담았어요 🎁");
  }

  /* --- 책 수정/삭제 --- */
  function updateBook(isbn: string, patch: Partial<Book>) {
    setBooks((prev) => prev.map((b) => (b.isbn === isbn ? { ...b, ...patch } : b)));
    setSelected((s) => (s && s.isbn === isbn ? { ...s, ...patch } : s));
  }
  function removeBook(isbn: string) {
    setBooks((prev) => prev.filter((b) => b.isbn !== isbn));
    setSelected(null);
  }
  function removeWish(isbn: string) {
    setWish((prev) => prev.filter((w) => w.isbn !== isbn));
  }
  function moveWishToLibrary(w: WishItem) {
    if (books.some((b) => b.isbn === w.isbn)) {
      flash("이미 서재에 있어요", true);
      return;
    }
    setBooks((prev) => [
      {
        isbn: w.isbn,
        title: w.title,
        author: w.author,
        publisher: "",
        pubDate: "",
        cover: w.cover,
        description: "",
        addedAt: new Date().toISOString(),
        status: "unread",
        rating: 0,
        memo: "",
        category: "",
        lentTo: "",
      },
      ...prev,
    ]);
    removeWish(w.isbn);
    flash("서재로 옮겼어요 📚");
  }

  /* --- 백업 --- */
  function download(name: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportJson() {
    download(
      "내서재-백업.json",
      JSON.stringify({ books, wish }, null, 2),
      "application/json"
    );
  }
  function exportCsv() {
    if (!books.length) return flash("내보낼 책이 없어요", true);
    const head = ["ISBN", "제목", "저자", "출판사", "출판일", "상태", "별점", "분야", "메모", "대출"];
    const rows = books.map((b) =>
      [
        b.isbn,
        b.title,
        b.author,
        b.publisher,
        b.pubDate,
        STATUS_LABEL[b.status],
        b.rating,
        b.category,
        b.memo,
        b.lentTo,
      ]
        .map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    download("내서재.csv", "\uFEFF" + head.join(",") + "\n" + rows.join("\n"), "text/csv");
  }
  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const incoming: Book[] = Array.isArray(data) ? data : data.books || [];
        const incomingWish: WishItem[] = Array.isArray(data) ? [] : data.wish || [];
        // ISBN 기준 병합 (기존 우선 유지, 새 것만 추가)
        setBooks((prev) => {
          const map = new Map(prev.map((b) => [b.isbn, b]));
          for (const b of incoming) if (!map.has(b.isbn)) map.set(b.isbn, b);
          return Array.from(map.values());
        });
        setWish((prev) => {
          const map = new Map(prev.map((w) => [w.isbn, w]));
          for (const w of incomingWish) if (!map.has(w.isbn)) map.set(w.isbn, w);
          return Array.from(map.values());
        });
        flash("백업을 불러왔어요");
      } catch {
        flash("파일을 읽을 수 없어요", true);
      }
    };
    reader.readAsText(file);
  }

  // 앱: 백업 JSON을 파일로 만들어 폰 공유 시트로 내보내기 (드라이브·카톡·파일앱에 저장)
  async function exportBackupApp() {
    if (!books.length) return flash("백업할 책이 없어요", true);
    const cap = (typeof window !== "undefined" ? (window as any).Capacitor : null);
    const Filesystem = cap?.Plugins?.Filesystem;
    const Share = cap?.Plugins?.Share;
    if (!Filesystem || !Share) {
      flash("백업 기능을 사용할 수 없어요", true);
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `내서재-백업-${stamp}.json`;
      const json = JSON.stringify({ books, wish }, null, 2);
      const res = await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: "CACHE",
        encoding: "utf8",
      });
      await Share.share({
        title: "리베르홈 백업",
        text: "리베르홈 백업 파일이에요. 드라이브·파일앱 등에 저장해두세요.",
        url: res.uri,
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") flash("백업 내보내기에 실패했어요", true);
    }
  }

  /* --- 파생 데이터 --- */
  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.category && set.add(b.category));
    return Array.from(set).sort();
  }, [books]);

  const shown = useMemo(() => {
    let arr = books.slice();
    const q = query.trim().toLowerCase();
    if (q)
      arr = arr.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.publisher.toLowerCase().includes(q)
      );
    if (statusFilter !== "all") arr = arr.filter((b) => b.status === statusFilter);
    if (catFilter !== "all")
      arr = arr.filter((b) => (catFilter === "__none" ? !b.category : b.category === catFilter));
    if (sort === "title") arr.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    else if (sort === "author") arr.sort((a, b) => a.author.localeCompare(b.author, "ko"));
    else arr.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
    return arr;
  }, [books, query, statusFilter, catFilter, sort]);

  const stats = useMemo(() => {
    const byStatus = { unread: 0, reading: 0, read: 0 } as Record<Status, number>;
    const authorCount: Record<string, number> = {};
    const catCount: Record<string, number> = {};
    for (const b of books) {
      byStatus[b.status]++;
      if (b.author) authorCount[b.author] = (authorCount[b.author] || 0) + 1;
      const c = b.category || "미분류";
      catCount[c] = (catCount[c] || 0) + 1;
    }
    const topAuthors = Object.entries(authorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const cats = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
    const lent = books.filter((b) => b.lentTo).length;
    return { byStatus, topAuthors, cats, lent };
  }, [books]);

  /* ============================ 렌더 ============================ */

  return (
    <main className="app">
      {/* 헤더 */}
      <header className="top">
        <div className="brand">
          <span className="mark">📚</span>
          <span>리베르홈</span>
        </div>
        <nav className="tabs">
          <button className={tab === "library" ? "on" : ""} onClick={() => setTab("library")}>
            서재 <em>{books.length}</em>
          </button>
          <button className={tab === "wish" ? "on" : ""} onClick={() => setTab("wish")}>
            위시 <em>{wish.length}</em>
          </button>
          <button className={tab === "stats" ? "on" : ""} onClick={() => setTab("stats")}>
            통계
          </button>
        </nav>
      </header>

      {/* ===== 서재 탭 ===== */}
      {tab === "library" && (
        <>
          {/* 스캔 바 */}
          <section className="scanzone">
            <div className={`scanbar${busy ? " busy" : ""}${quickMode ? " quick" : ""}`}>
              <span className="beam" />
              <input
                ref={scanRef}
                className="scan"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                placeholder={quickMode ? "확인할 책 바코드를 스캔…" : "바코드 스캔 또는 ISBN 입력…"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleScan((e.target as HTMLInputElement).value);
                  }
                }}
              />
              <button
                className="gobtn"
                onClick={() => handleScan(scanRef.current?.value || "")}
              >
                {quickMode ? "확인" : "추가"}
              </button>
              <button className="cambtn" onClick={openScanner} title="카메라로 스캔">
                📷
              </button>
            </div>
            <div className="scanopts">
              <label className={`switch${quickMode ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={quickMode}
                  onChange={(e) => {
                    setQuickMode(e.target.checked);
                    setQuickResult(null);
                  }}
                />
                <span className="track">
                  <span className="knob" />
                </span>
                빠른 확인 모드 <b>{quickMode ? "ON" : "OFF"}</b>
              </label>
              <span className="scanhint">
                {quickMode
                  ? "서점에서 스캔해 '집에 있나?' 바로 확인해요."
                  : "USB 스캐너 · 폰 카메라 · 직접 입력 모두 OK"}
              </span>
            </div>

            {/* 빠른 확인 결과 배너 */}
            {quickResult && (
              <div className={`qbanner ${quickResult.owned ? "have" : "not"}`}>
                {quickResult.owned ? (
                  <>
                    <div className="qmsg">
                      <b>📚 집에 있어요!</b>
                      <span>{quickResult.book?.title || quickResult.isbn}</span>
                      {quickResult.book?.lentTo && (
                        <em className="lentnote">📤 {quickResult.book.lentTo} 에게 빌려준 상태</em>
                      )}
                    </div>
                    <button className="qx" onClick={() => setQuickResult(null)}>
                      확인
                    </button>
                  </>
                ) : (
                  <>
                    <div className="qmsg">
                      <b>🛒 집에 없는 책이에요</b>
                      <span>{quickResult.info?.title || `ISBN ${quickResult.isbn}`}</span>
                    </div>
                    <div className="qacts">
                      <button className="mini p" onClick={addFromQuick}>
                        서재에 추가
                      </button>
                      <button className="mini g" onClick={wishFromQuick}>
                        🎁 위시리스트
                      </button>
                      <button className="qx" onClick={() => setQuickResult(null)}>
                        닫기
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* 컨트롤 바 */}
          {books.length > 0 && (
            <section className="controls">
              <div className="searchbox">
                🔍
                <input
                  type="text"
                  placeholder="제목·저자·출판사 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="chips">
                <button
                  className={statusFilter === "all" ? "chip on" : "chip"}
                  onClick={() => setStatusFilter("all")}
                >
                  전체
                </button>
                {(["unread", "reading", "read"] as Status[]).map((s) => (
                  <button
                    key={s}
                    className={statusFilter === s ? "chip on" : "chip"}
                    onClick={() => setStatusFilter(s)}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <div className="right-ctrls">
                {categories.length > 0 && (
                  <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                    <option value="all">분야 전체</option>
                    <option value="__none">미분류</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
                  <option value="added">최근 등록순</option>
                  <option value="title">제목순</option>
                  <option value="author">저자순</option>
                </select>
                <div className="viewtoggle">
                  <button className={view === "shelf" ? "on" : ""} onClick={() => setView("shelf")}>
                    책장
                  </button>
                  <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
                    목록
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 본문 */}
          {books.length === 0 ? (
            <div className="empty">
              <div className="emo">📖</div>
              <div className="big">서재가 비어 있어요</div>
              <p>
                책 뒷면 <b>바코드</b>를 스캔해보세요.<br />
                📷 카메라 · USB 스캐너 · ISBN 직접 입력 모두 됩니다.
              </p>
              <button className="ghostbtn" onClick={() => setShowIntro(true)}>
                사용법 다시 보기
              </button>
            </div>
          ) : view === "shelf" ? (
            <>
              <div className="shelfbar">
                <button className="sharebtn" onClick={shareShelf}>
                  📤 공유
                </button>
                <button className="themebtn" onClick={() => setThemeOpen(true)}>
                  🎨 책장 스타일
                </button>
              </div>
              <section className="shelf" data-shelf-theme={shelfTheme}>
              {shown.map((b) => {
                const c = colorFor(b);
                const tilt = (hashStr(b.isbn) % 5) - 2; // -2°~2°
                return (
                  <button
                    key={b.isbn}
                    className="bookwrap"
                    onClick={() => setSelected(b)}
                    title={b.title || b.isbn}
                  >
                    <span className="book3d" style={{ ["--tilt" as any]: `${tilt}deg` }}>
                      {b.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="bookcover" src={b.cover} alt={b.title} />
                      ) : (
                        <span
                          className="bookcover blank"
                          style={{ background: c.bg, color: c.ink }}
                        >
                          <span className="blank-title">{b.title || "제목 미확인"}</span>
                          {b.author && <span className="blank-author">{b.author}</span>}
                        </span>
                      )}
                      {(b.status === "read" || b.lentTo) && (
                        <span className="bookbadge">{b.lentTo ? "📤" : "✓"}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </section>
            </>
          ) : (
            <section className="listview">
              {shown.map((b) => (
                <button key={b.isbn} className="lcard" onClick={() => setSelected(b)}>
                  <span className="lcover">
                    {b.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.cover} alt="" />
                    ) : (
                      <span className="lspine" style={{ background: colorFor(b).bg }} />
                    )}
                  </span>
                  <span className="lmeta">
                    <span className={`ltitle${b.title ? "" : " unknown"}`}>
                      {b.title || "제목 미확인 — 눌러서 입력"}
                    </span>
                    <span className="lsub">
                      {[b.author, b.publisher].filter(Boolean).join(" · ")}
                    </span>
                    <span className="ltags">
                      <span className={`stpill ${b.status}`}>{STATUS_LABEL[b.status]}</span>
                      {b.category && <span className="catpill">{b.category}</span>}
                      {b.rating > 0 && <span className="rate">{"★".repeat(b.rating)}</span>}
                      {b.lentTo && <span className="lent">📤 {b.lentTo}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {/* 백업 바 */}
          {isApp ? (
            <section className="backup">
              <span>💾 백업</span>
              <button onClick={exportBackupApp}>백업 파일 내보내기</button>
            </section>
          ) : (
            <section className="backup">
              <span>💾 백업</span>
              <button onClick={exportJson}>JSON 내보내기</button>
              <button onClick={exportCsv}>CSV 내보내기</button>
              <label className="importlbl">
                불러오기
                <input
                  type="file"
                  accept="application/json"
                  onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
                />
              </label>
            </section>
          )}
          <p className="localnote">
            📌 이 서재는 <b>이 기기에만</b> 저장돼요. 기기를 바꾸거나 앱을 지우기 전에 꼭 백업하세요.
          </p>
        </>
      )}

      {/* ===== 위시리스트 탭 ===== */}
      {tab === "wish" && (
        <section className="wishtab">
          {wish.length === 0 ? (
            <div className="empty">
              <div className="emo">🎁</div>
              <div className="big">위시리스트가 비어 있어요</div>
              <p>빠른 확인 모드로 서점에서 스캔한 뒤 "위시리스트"를 누르면 여기 담깁니다.</p>
            </div>
          ) : (
            wish.map((w) => (
              <div key={w.isbn} className="lcard static">
                <span className="lcover">
                  {w.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.cover} alt="" />
                  ) : (
                    <span className="lspine" style={{ background: "#F0EAFB" }} />
                  )}
                </span>
                <span className="lmeta">
                  <span className="ltitle">{w.title || `ISBN ${w.isbn}`}</span>
                  <span className="lsub">{w.author}</span>
                  <span className="ltags">
                    <button className="mini p" onClick={() => moveWishToLibrary(w)}>
                      📚 샀어요 → 서재로
                    </button>
                    <button className="mini g" onClick={() => removeWish(w.isbn)}>
                      삭제
                    </button>
                  </span>
                </span>
              </div>
            ))
          )}
        </section>
      )}

      {/* ===== 통계 탭 ===== */}
      {tab === "stats" && (
        <section className="statstab">
          <div className="statcards">
            <div className="stcard g">
              <b>{books.length}</b>
              <span>총 보유</span>
            </div>
            <div className="stcard b">
              <b>{stats.byStatus.read}</b>
              <span>읽음</span>
            </div>
            <div className="stcard o">
              <b>{stats.byStatus.reading}</b>
              <span>읽는 중</span>
            </div>
            <div className="stcard p">
              <b>{stats.byStatus.unread}</b>
              <span>안 읽음</span>
            </div>
            <div className="stcard r">
              <b>{stats.lent}</b>
              <span>빌려준 책</span>
            </div>
          </div>

          <div className="statblock">
            <h3>📚 분야 분포</h3>
            {stats.cats.length === 0 ? (
              <p className="dim">아직 분야를 지정한 책이 없어요.</p>
            ) : (
              stats.cats.map(([name, n]) => (
                <div key={name} className="barrow">
                  <span className="blabel">{name}</span>
                  <span className="btrack">
                    <span
                      className="bfill"
                      style={{ width: `${Math.round((n / books.length) * 100)}%` }}
                    />
                  </span>
                  <span className="bnum">{n}</span>
                </div>
              ))
            )}
          </div>

          <div className="statblock">
            <h3>✍️ 많이 가진 저자</h3>
            {stats.topAuthors.length === 0 ? (
              <p className="dim">저자 정보가 아직 없어요.</p>
            ) : (
              <ol className="authorlist">
                {stats.topAuthors.map(([name, n]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <em>{n}권</em>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {/* 카메라 모달 */}
      {camOpen && (
        <CameraScanner
          onDetected={(code) => handleScan(code)}
          onClose={() => {
            setCamOpen(false);
            refocus();
          }}
        />
      )}

      {/* 첫 방문 안내 */}
      {showIntro && (
        <div
          className="modal-bg"
          onClick={() => {
            try {
              localStorage.setItem("booklog:seen", "1");
            } catch {}
            setShowIntro(false);
            refocus();
          }}
        >
          <div className="modal intro" onClick={(e) => e.stopPropagation()}>
            <div className="intro-hero">
              <div className="intro-emo">📚</div>
              <h2>우리집 책, 한눈에</h2>
              <p>집에 어떤 책이 있는지 헷갈릴 때, 스캔 한 번으로 정리하세요.</p>
            </div>
            <ul className="intro-list">
              <li>
                <span>📷</span>
                <div>
                  <b>바코드 스캔</b>
                  <em>책 뒷면 바코드를 카메라·스캐너로 찍거나 ISBN을 입력해요.</em>
                </div>
              </li>
              <li>
                <span>⚡</span>
                <div>
                  <b>빠른 확인 모드</b>
                  <em>서점에서 스캔해 "집에 이미 있나?"를 즉석에서 확인 — 중복 구매 방지.</em>
                </div>
              </li>
              <li>
                <span>📖</span>
                <div>
                  <b>책장·상태·메모</b>
                  <em>표지가 꽂힌 책장으로 보고, 읽음/대출/둔 위치까지 기록해요.</em>
                </div>
              </li>
            </ul>
            <div className="intro-warn">
              ⚠️ 이 서재는 <b>이 기기(브라우저)에만</b> 저장돼요. 계정·로그인이 없는 대신,
              캐시를 지우거나 기기를 바꾸면 사라집니다. 가끔 <b>JSON 내보내기</b>로 백업하세요.
            </div>
            <button
              className="intro-cta"
              onClick={() => {
                try {
                  localStorage.setItem("booklog:seen", "1");
                } catch {}
                setShowIntro(false);
                refocus();
              }}
            >
              시작하기
            </button>
          </div>
        </div>
      )}

      {/* 책 상세 모달 */}
      {selected && (
        <div className="modal-bg" onClick={() => setSelected(null)}>
          <div className="modal detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>책 정보</b>
              <button className="x" onClick={() => setSelected(null)} aria-label="닫기">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <div className="dbody">
              <div className="dcover">
                {selected.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.cover} alt="" />
                ) : (
                  <span className="lspine" style={{ background: colorFor(selected).bg }} />
                )}
              </div>
              <div className="dinfo">
                <input
                  className="dtitle"
                  value={selected.title}
                  placeholder="제목 입력"
                  onChange={(e) => updateBook(selected.isbn, { title: e.target.value })}
                />
                <input
                  className="dline"
                  value={selected.author}
                  placeholder="저자"
                  onChange={(e) => updateBook(selected.isbn, { author: e.target.value })}
                />
                <div className="dmeta">
                  {[selected.publisher, selected.pubDate].filter(Boolean).join(" · ")}
                  <br />
                  ISBN {selected.isbn}
                </div>
              </div>
            </div>

            <div className="drow">
              <label>상태</label>
              <div className="segbtns">
                {(["unread", "reading", "read"] as Status[]).map((s) => (
                  <button
                    key={s}
                    className={selected.status === s ? "seg on" : "seg"}
                    onClick={() => updateBook(selected.isbn, { status: s })}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="drow">
              <label>별점</label>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={n <= selected.rating ? "star on" : "star"}
                    onClick={() =>
                      updateBook(selected.isbn, {
                        rating: selected.rating === n ? 0 : n,
                      })
                    }
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="drow">
              <label>분야</label>
              <input
                className="dline"
                value={selected.category}
                placeholder="예: 소설, 경제, 철학…"
                onChange={(e) => updateBook(selected.isbn, { category: e.target.value })}
              />
            </div>

            <div className="drow">
              <label>빌려준 사람</label>
              <input
                className="dline"
                value={selected.lentTo}
                placeholder="비워두면 '집에 있음'"
                onChange={(e) => updateBook(selected.isbn, { lentTo: e.target.value })}
              />
            </div>

            <div className="drow col">
              <label>메모</label>
              <textarea
                value={selected.memo}
                placeholder="느낀 점, 둔 위치(예: 안방 책장) 등"
                onChange={(e) => updateBook(selected.isbn, { memo: e.target.value })}
              />
            </div>

            <button className="deletebtn" onClick={() => removeBook(selected.isbn)}>
              🗑 서재에서 삭제
            </button>
          </div>
        </div>
      )}

      {/* 책장 스타일 선택 */}
      {themeOpen && (
        <div className="modal-bg" onClick={() => setThemeOpen(false)}>
          <div className="modal theme" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>책장 스타일</b>
              <button className="x" onClick={() => setThemeOpen(false)} aria-label="닫기">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <div className="themegrid">
              {([
                { id: "wood", label: "원목" },
                { id: "white", label: "화이트" },
                { id: "dark", label: "다크 서재" },
                { id: "pastel", label: "파스텔" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  className={`themecard${shelfTheme === t.id ? " on" : ""}`}
                  onClick={() => {
                    setShelfTheme(t.id);
                    setThemeOpen(false);
                    flash(`책장 스타일: ${t.label}`);
                  }}
                >
                  <span className={`themeprev tp-${t.id}`}>
                    <span className="tp-book b1" />
                    <span className="tp-book b2" />
                    <span className="tp-book b3" />
                    <span className="tp-board" />
                  </span>
                  <span className="themelabel">
                    {t.label}
                    {shelfTheme === t.id && <em> ✓</em>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast${toast.warn ? " warn" : ""}`}>{toast.msg}</div>}

      {/* ============================ 스타일 ============================ */}
      <style jsx global>{`
        :root {
          --green: #1fa45b;
          --green-deep: #157a42;
          --green-soft: #e7f5ec;
          --ink: #1c2420;
          --sub: #69756d;
          --line: #e5e9e6;
          --bg: #fafbfa;
          --card: #fff;
          --gold: #d9930d;
          --sans: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo",
            "Malgun Gothic", sans-serif;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: var(--sans);
          background: var(--bg);
          color: var(--ink);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          word-break: keep-all;
        }
        button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
        input, select, textarea { font-family: inherit; }
      `}</style>

      <style jsx>{`
        .app { max-width: 880px; margin: 0 auto; padding: 0 18px 90px; }

        /* 헤더 */
        .top {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 0; background: rgba(250, 251, 250, 0.92); backdrop-filter: blur(8px);
        }
        .brand { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
        .brand .mark { font-size: 24px; }
        .tabs { display: flex; gap: 4px; background: #eef1ee; border-radius: 12px; padding: 4px; }
        .tabs button {
          padding: 8px 14px; border-radius: 9px; font-size: 14px; font-weight: 700; color: var(--sub);
          display: flex; align-items: center; gap: 6px; transition: 0.15s;
        }
        .tabs button.on { background: #fff; color: var(--green-deep); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06); }
        .tabs em { font-style: normal; font-size: 12px; background: var(--green-soft); color: var(--green-deep);
          border-radius: 20px; padding: 1px 8px; }

        /* 스캔 */
        .scanzone { margin-top: 6px; }
        .scanbar {
          display: flex; align-items: center; gap: 10px;
          background: var(--green); border-radius: 16px; padding: 14px 14px 14px 18px;
          box-shadow: 0 14px 30px -14px rgba(31, 164, 91, 0.6); transition: 0.2s;
        }
        .scanbar.quick { background: var(--gold); box-shadow: 0 14px 30px -14px rgba(217, 147, 13, 0.6); }
        .scanbar.busy { opacity: 0.85; }
        .beam { width: 12px; height: 30px; border-radius: 3px; background: rgba(255, 255, 255, 0.85);
          animation: pulse 1.4s ease-in-out infinite; flex: none; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        .scan { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #fff; font-size: 18px; font-weight: 600; }
        .scan::placeholder { color: rgba(255, 255, 255, 0.65); font-weight: 500; }
        .gobtn { flex: none; height: 46px; padding: 0 16px; border-radius: 12px; background: #fff;
          color: var(--green-deep); font-size: 15px; font-weight: 800; transition: 0.15s; white-space: nowrap; }
        .scanbar.quick .gobtn { color: var(--gold); }
        .gobtn:hover { background: #f0f4f0; }
        .gobtn:active { transform: scale(0.95); }
        .cambtn { width: 46px; height: 46px; flex: none; display: flex; align-items: center; justify-content: center;
          font-size: 22px; background: rgba(255, 255, 255, 0.25); border-radius: 12px; transition: 0.15s; }
        .cambtn:hover { background: rgba(255, 255, 255, 0.36); }
        .cambtn:active { transform: scale(0.93); }

        .scanopts { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 6px 4px; }
        .switch { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--sub); cursor: pointer; }
        .switch input { display: none; }
        .switch .track { width: 40px; height: 23px; border-radius: 20px; background: #d5dad6; position: relative; transition: 0.2s; }
        .switch .knob { position: absolute; top: 2px; left: 2px; width: 19px; height: 19px; border-radius: 50%; background: #fff; transition: 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
        .switch.on .track { background: var(--gold); }
        .switch.on .knob { left: 19px; }
        .switch b { color: var(--ink); }
        .scanhint { font-size: 12.5px; color: var(--sub); }

        .qbanner {
          margin-top: 12px; border-radius: 14px; padding: 16px 18px;
          display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
          animation: pop 0.25s ease;
        }
        @keyframes pop { from { transform: scale(0.97); opacity: 0; } to { transform: none; opacity: 1; } }
        .qbanner.have { background: var(--green-soft); border: 1.5px solid #bfe6cd; }
        .qbanner.not { background: #fcf3df; border: 1.5px solid #f0dca6; }
        .qmsg { display: flex; flex-direction: column; gap: 2px; }
        .qmsg b { font-size: 18px; font-weight: 900; }
        .qmsg span { font-size: 14px; color: var(--sub); }
        .lentnote { font-style: normal; font-size: 12.5px; color: #d04545; font-weight: 700; }
        .qacts { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .qx { font-size: 13px; font-weight: 700; color: var(--sub); padding: 8px 12px; border-radius: 9px; }
        .qx:hover { background: rgba(0, 0, 0, 0.05); }
        .mini { font-size: 13px; font-weight: 700; border-radius: 9px; padding: 8px 13px; }
        .mini.p { background: var(--green); color: #fff; }
        .mini.p:hover { background: var(--green-deep); }
        .mini.g { background: #fff; border: 1.5px solid var(--line); }

        /* 컨트롤 */
        .controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 18px 0 14px; }
        .searchbox { display: flex; align-items: center; gap: 7px; background: #fff; border: 1.5px solid var(--line);
          border-radius: 11px; padding: 9px 13px; flex: 1; min-width: 180px; font-size: 14px; }
        .searchbox input { border: none; outline: none; flex: 1; font-size: 14px; background: none; }
        .chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { font-size: 13px; font-weight: 700; color: var(--sub); background: #fff; border: 1.5px solid var(--line);
          border-radius: 20px; padding: 7px 13px; transition: 0.15s; }
        .chip.on { background: var(--green); color: #fff; border-color: var(--green); }
        .right-ctrls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        select { font-size: 13px; font-weight: 600; border: 1.5px solid var(--line); border-radius: 10px; padding: 8px 10px; background: #fff; color: var(--ink); }
        .viewtoggle { display: flex; background: #eef1ee; border-radius: 10px; padding: 3px; }
        .viewtoggle button { font-size: 13px; font-weight: 700; color: var(--sub); padding: 6px 12px; border-radius: 8px; }
        .viewtoggle button.on { background: #fff; color: var(--green-deep); box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06); }

        /* 빈 상태 */
        .empty { text-align: center; padding: 70px 20px; color: var(--sub); }
        .empty .emo { font-size: 52px; }
        .empty .big { font-size: 21px; font-weight: 900; color: var(--ink); margin: 10px 0 4px; }

        /* 책장 스타일 바 */
        .shelfbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .sharebtn { font-size: 13px; font-weight: 700; color: #fff; background: var(--green);
          border-radius: 20px; padding: 7px 15px; transition: 0.15s; }
        .sharebtn:hover { background: var(--green-deep); }
        .sharebtn:active { transform: scale(0.96); }
        .themebtn { font-size: 13px; font-weight: 700; color: var(--green-deep);
          background: var(--green-soft); border-radius: 20px; padding: 7px 14px; transition: 0.15s; }
        .themebtn:hover { background: #d6efdf; }
        .themebtn:active { transform: scale(0.96); }

        /* 책장 뷰 — 표지가 세워진 모습 (테마 변수로 색 전환) */
        .shelf {
          --shelf-bg1: #fbf7ef; --shelf-bg2: #f5ecdd;
          --board1: #e7d4ae; --board2: #d6bd88; --board3: #c9ae74;
          --shelf-border: #ece1cc; --shelf-inset: rgba(255, 255, 255, 0.9);
          display: flex; flex-wrap: wrap; align-items: flex-end;
          justify-content: flex-start; gap: 0 14px;
          background: linear-gradient(var(--shelf-bg1), var(--shelf-bg2));
          border: 1px solid var(--shelf-border); border-radius: 16px; padding: 22px 18px 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0, transparent 134px,
            var(--board1) 134px, var(--board2) 144px, var(--board3) 148px
          );
          background-size: 100% 148px; box-shadow: inset 0 1px 0 var(--shelf-inset);
        }
        .shelf[data-shelf-theme="white"] {
          --shelf-bg1: #ffffff; --shelf-bg2: #f3f6f3;
          --board1: #e6e9e6; --board2: #d3d8d3; --board3: #c4cbc4;
          --shelf-border: #e5e9e6; --shelf-inset: #ffffff;
        }
        .shelf[data-shelf-theme="dark"] {
          --shelf-bg1: #2c2824; --shelf-bg2: #211e1a;
          --board1: #4d4130; --board2: #3b3123; --board3: #2e2618;
          --shelf-border: #3a342c; --shelf-inset: rgba(255, 255, 255, 0.06);
        }
        .shelf[data-shelf-theme="pastel"] {
          --shelf-bg1: #eef7f0; --shelf-bg2: #e2efe7;
          --board1: #cfe6d5; --board2: #bcdcc6; --board3: #a9d1b6;
          --shelf-border: #d5e8db; --shelf-inset: #ffffff;
        }

        /* 테마 선택 모달 */
        .modal.theme { max-width: 400px; }
        .themegrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 18px 20px 22px; }
        .themecard { border: 2px solid var(--line); border-radius: 14px; padding: 10px; background: #fff;
          transition: 0.15s; display: flex; flex-direction: column; gap: 8px; }
        .themecard:hover { border-color: var(--brass-soft); }
        .themecard.on { border-color: var(--green); box-shadow: 0 0 0 3px var(--green-soft); }
        .themeprev { position: relative; height: 76px; border-radius: 9px; overflow: hidden;
          display: flex; align-items: flex-end; justify-content: center; gap: 5px; padding-bottom: 12px; }
        .themeprev .tp-book { width: 13px; border-radius: 2px; }
        .themeprev .b1 { height: 42px; background: #FCD34D; }
        .themeprev .b2 { height: 52px; background: #ffffff; }
        .themeprev .b3 { height: 46px; background: #5AA9F0; }
        .themeprev .tp-board { position: absolute; left: 8px; right: 8px; bottom: 6px; height: 7px; border-radius: 4px; }
        .tp-wood { background: linear-gradient(#fbf7ef, #f0e2c9); }
        .tp-wood .tp-board { background: #d6bd88; }
        .tp-white { background: linear-gradient(#ffffff, #eef1ee); }
        .tp-white .tp-board { background: #cfd5cf; }
        .tp-white .b2 { background: #f2f4f2; box-shadow: inset 0 0 0 1px #e2e6e2; }
        .tp-dark { background: linear-gradient(#2c2824, #211e1a); }
        .tp-dark .tp-board { background: #4d4130; }
        .tp-pastel { background: linear-gradient(#eef7f0, #dcece2); }
        .tp-pastel .tp-board { background: #b6d9c1; }
        .themelabel { font-size: 13.5px; font-weight: 800; text-align: center; }
        .themelabel em { font-style: normal; color: var(--green); }
        .bookwrap {
          height: 148px; display: flex; align-items: flex-end;
          padding-bottom: 14px; perspective: 500px;
        }
        .book3d {
          position: relative; width: 80px; height: 114px; border-radius: 2px 5px 5px 2px;
          box-shadow: 3px 5px 9px rgba(40, 30, 12, 0.22); overflow: hidden;
          transform: rotate(var(--tilt, 0deg));
          transition: transform 0.16s ease, box-shadow 0.16s ease; will-change: transform;
        }
        /* 책등 두께 느낌: 왼쪽에 살짝 어두운 띠 */
        .book3d::before {
          content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 5px; z-index: 2;
          background: linear-gradient(90deg, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0));
        }
        .bookwrap:hover .book3d {
          transform: rotate(0deg) translateY(-8px);
          box-shadow: 5px 10px 18px rgba(40, 30, 12, 0.3);
        }
        .bookcover { display: block; width: 100%; height: 100%; object-fit: cover; }
        .bookcover.blank {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 5px; padding: 10px 8px; text-align: center;
        }
        .blank-title { font-size: 11.5px; font-weight: 800; line-height: 1.25; letter-spacing: -0.02em;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .blank-author { font-size: 9.5px; opacity: 0.7; }
        .bookbadge {
          position: absolute; top: 4px; right: 4px; z-index: 3; font-size: 11px;
          background: rgba(255, 255, 255, 0.92); border-radius: 20px; padding: 1px 5px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        /* 목록 뷰 */
        .listview { display: flex; flex-direction: column; gap: 10px; }
        .lcard { display: flex; gap: 14px; align-items: flex-start; text-align: left; width: 100%;
          background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 13px 15px; transition: 0.14s; }
        .lcard:hover { box-shadow: 0 8px 20px rgba(28, 36, 32, 0.08); transform: translateY(-2px); }
        .lcard.static:hover { transform: none; box-shadow: none; }
        .lcover { width: 48px; height: 68px; flex: none; border-radius: 4px; overflow: hidden; background: #eef1ee; }
        .lcover img { width: 100%; height: 100%; object-fit: cover; }
        .lspine { display: block; width: 100%; height: 100%; }
        .lmeta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .ltitle { font-size: 16px; font-weight: 800; line-height: 1.35; }
        .ltitle.unknown { color: var(--sub); font-weight: 500; font-style: italic; }
        .lsub { font-size: 13px; color: var(--sub); }
        .ltags { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 5px; }
        .stpill { font-size: 11.5px; font-weight: 800; border-radius: 6px; padding: 2px 8px; }
        .stpill.unread { background: #eef1ee; color: #69756d; }
        .stpill.reading { background: #e8f0fb; color: #2d6fd2; }
        .stpill.read { background: var(--green-soft); color: var(--green-deep); }
        .catpill { font-size: 11.5px; font-weight: 700; background: #f0eafb; color: #7a4fd0; border-radius: 6px; padding: 2px 8px; }
        .rate { font-size: 12px; color: var(--gold); }
        .lent { font-size: 11.5px; font-weight: 700; color: #d04545; }

        /* 백업 */
        .backup { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 22px;
          padding-top: 18px; border-top: 1px dashed var(--line); font-size: 13px; }
        .backup > span { font-weight: 800; color: var(--sub); margin-right: 4px; }
        .backup button, .importlbl { font-size: 13px; font-weight: 700; color: var(--green-deep);
          background: var(--green-soft); border-radius: 9px; padding: 8px 13px; cursor: pointer; }
        .importlbl input { display: none; }
        .localnote { font-size: 12.5px; color: var(--sub); margin-top: 10px; }
        .localnote b { color: var(--ink); }

        /* 위시 */
        .wishtab { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

        /* 통계 */
        .statstab { margin-top: 16px; }
        .statcards { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
        .stcard { border-radius: 15px; padding: 18px 16px; color: #fff; }
        .stcard b { display: block; font-size: 30px; font-weight: 900; line-height: 1; }
        .stcard span { font-size: 13px; opacity: 0.92; }
        .stcard.g { background: linear-gradient(135deg, #34c173, #157a42); }
        .stcard.b { background: linear-gradient(135deg, #5a95e0, #2d6fd2); }
        .stcard.o { background: linear-gradient(135deg, #eb9a4e, #e0662b); }
        .stcard.p { background: linear-gradient(135deg, #9d76de, #7a4fd0); }
        .stcard.r { background: linear-gradient(135deg, #e07070, #d04545); }
        .statblock { background: #fff; border: 1px solid var(--line); border-radius: 15px; padding: 20px 22px; margin-top: 14px; }
        .statblock h3 { font-size: 16px; font-weight: 900; margin-bottom: 14px; }
        .dim { color: var(--sub); font-size: 14px; }
        .barrow { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; font-size: 13.5px; }
        .blabel { width: 92px; flex: none; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btrack { flex: 1; height: 12px; background: #eef1ee; border-radius: 20px; overflow: hidden; }
        .bfill { display: block; height: 100%; background: linear-gradient(90deg, #34c173, #1fa45b); border-radius: 20px; }
        .bnum { width: 30px; text-align: right; color: var(--sub); font-weight: 700; }
        .authorlist { list-style: none; counter-reset: a; }
        .authorlist li { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 14.5px; }
        .authorlist li:last-child { border: none; }
        .authorlist li::before { counter-increment: a; content: counter(a); display: inline-flex; width: 22px; height: 22px;
          margin-right: 10px; border-radius: 50%; background: var(--green-soft); color: var(--green-deep); font-size: 12px; font-weight: 900;
          align-items: center; justify-content: center; }
        .authorlist li span { flex: 1; font-weight: 700; }
        .authorlist li em { font-style: normal; color: var(--sub); font-size: 13px; }

        /* 모달 공통 */
        .modal-bg { position: fixed; inset: 0; background: rgba(20, 30, 24, 0.45); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 18px; z-index: 60; animation: fade 0.15s; }
        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
        .modal { background: #fff; border-radius: 20px; width: 100%; max-width: 440px; max-height: 90vh; overflow: auto;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.3); animation: rise 0.2s ease; }
        @keyframes rise { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 14px 20px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: #fff; z-index: 5; }
        .modal-head b { font-size: 16px; font-weight: 900; }
        .x { font-size: 20px; font-weight: 700; color: var(--ink); width: 40px; height: 40px; flex: none;
          display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #eef1ee; transition: 0.15s; }
        .x:hover { background: #dfe4e0; }
        .x:active { transform: scale(0.92); }

        /* 카메라 */
        .modal.cam { max-width: 400px; overflow: hidden; }
        .cam-head { display: flex; align-items: center; justify-content: space-between;
          padding: 14px 14px 12px 18px; }
        .cam-head b { font-size: 16px; font-weight: 900; }
        .cam-close { width: 40px; height: 40px; flex: none; display: flex; align-items: center; justify-content: center;
          border-radius: 50%; background: #eef1ee; color: var(--ink); }
        .cam-close:hover { background: #dfe4e0; }
        .cam-close:active { transform: scale(0.92); }
        .cam-stage { position: relative; }
        .reader { width: 100%; min-height: 260px; background: #000; overflow: hidden; }
        .reader :global(video) { width: 100% !important; height: auto !important; display: block; }
        .reader :global(img) { display: none; }
        /* 영상 위에 뜨는 큰 닫기 버튼 (눈에 잘 띄게) */
        .cam-close-float { position: absolute; top: 12px; right: 12px; z-index: 4;
          width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
          border-radius: 50%; background: rgba(0, 0, 0, 0.6); color: #fff; backdrop-filter: blur(4px);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4); }
        .cam-close-float:hover { background: rgba(0, 0, 0, 0.75); }
        .cam-close-float:active { transform: scale(0.92); }
        .cam-tip, .cam-err { padding: 14px 18px; font-size: 13.5px; color: var(--sub); text-align: center; }
        .cam-err { color: #d04545; font-weight: 600; }

        /* 첫 방문 안내 */
        .ghostbtn { margin-top: 16px; font-size: 13.5px; font-weight: 700; color: var(--green-deep);
          background: var(--green-soft); border-radius: 10px; padding: 9px 16px; }
        .modal.intro { max-width: 400px; text-align: center; overflow: hidden; }
        .intro-hero { background: linear-gradient(135deg, #34c173, #157a42); color: #fff; padding: 30px 24px 24px; }
        .intro-emo { font-size: 44px; }
        .intro-hero h2 { font-size: 22px; font-weight: 900; margin: 8px 0 6px; }
        .intro-hero p { font-size: 14px; opacity: 0.95; line-height: 1.5; }
        .intro-list { list-style: none; padding: 18px 20px 4px; text-align: left; }
        .intro-list li { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; }
        .intro-list li span { font-size: 22px; flex: none; width: 30px; text-align: center; }
        .intro-list b { display: block; font-size: 14.5px; font-weight: 800; }
        .intro-list em { font-style: normal; font-size: 13px; color: var(--sub); line-height: 1.5; }
        .intro-warn { margin: 8px 20px 0; background: #fcf3df; border: 1.5px solid #f0dca6; border-radius: 12px;
          padding: 13px 15px; font-size: 12.5px; color: #6b5518; line-height: 1.55; text-align: left; }
        .intro-warn b { color: #4a3a0e; }
        .intro-cta { margin: 18px 20px 22px; width: calc(100% - 40px); background: var(--green); color: #fff;
          font-size: 15px; font-weight: 800; border-radius: 12px; padding: 14px; }
        .intro-cta:hover { background: var(--green-deep); }
        .intro-cta:active { transform: scale(0.98); }

        /* 상세 */
        .detail .dbody { display: flex; gap: 14px; padding: 18px 20px; }
        .dcover { width: 76px; height: 108px; flex: none; border-radius: 6px; overflow: hidden; background: #eef1ee; }
        .dcover img { width: 100%; height: 100%; object-fit: cover; }
        .dinfo { flex: 1; min-width: 0; }
        .dtitle { width: 100%; font-size: 18px; font-weight: 900; border: none; outline: none; border-bottom: 2px solid transparent; padding: 2px 0; }
        .dtitle:focus { border-color: var(--green-soft); }
        .dline { width: 100%; font-size: 14px; border: 1.5px solid var(--line); border-radius: 9px; padding: 8px 11px; outline: none; margin-top: 6px; }
        .dline:focus { border-color: var(--green); }
        .dmeta { font-size: 12px; color: var(--sub); margin-top: 8px; line-height: 1.5; }
        .drow { display: flex; align-items: center; gap: 12px; padding: 11px 20px; border-top: 1px solid var(--line); }
        .drow.col { flex-direction: column; align-items: stretch; gap: 7px; }
        .drow > label { width: 74px; flex: none; font-size: 13px; font-weight: 800; color: var(--sub); }
        .drow.col > label { width: auto; }
        .drow .dline { margin-top: 0; }
        .segbtns { display: flex; gap: 6px; }
        .seg { font-size: 13px; font-weight: 700; color: var(--sub); background: #eef1ee; border-radius: 9px; padding: 7px 12px; }
        .seg.on { background: var(--green); color: #fff; }
        .stars { display: flex; gap: 2px; }
        .star { font-size: 24px; color: #d8dcd8; line-height: 1; }
        .star.on { color: var(--gold); }
        .drow textarea { width: 100%; min-height: 72px; resize: vertical; border: 1.5px solid var(--line); border-radius: 10px; padding: 10px 12px; outline: none; font-size: 14px; line-height: 1.5; }
        .drow textarea:focus { border-color: var(--green); }
        .deletebtn { margin: 8px 20px 20px; font-size: 13.5px; font-weight: 700; color: #d04545; background: #fae9e9; border-radius: 10px; padding: 11px; width: calc(100% - 40px); }
        .deletebtn:hover { background: #f6dada; }

        /* 토스트 */
        .toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); background: var(--green-deep);
          color: #fff; padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 600;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25); z-index: 80; animation: rise 0.2s ease; }
        .toast.warn { background: var(--gold); }

        @media (max-width: 620px) {
          .app { padding: 0 14px 90px; }
          .top { flex-wrap: wrap; gap: 10px; }
          .tabs { width: 100%; justify-content: space-between; }
          .tabs button { flex: 1; justify-content: center; }

          /* 컨트롤: 한 줄에 욱여넣지 말고 줄바꿈으로 정리 */
          .controls { gap: 8px; }
          .searchbox { flex: 1 1 100%; min-width: 0; order: 1; }
          .chips { order: 2; width: 100%; }
          .chips .chip { flex: 1; text-align: center; padding: 8px 6px; }
          .right-ctrls { order: 3; width: 100%; justify-content: space-between; }
          .right-ctrls select { flex: 1; }

          /* 책장: 표지를 살짝 작게 해 한 줄에 여러 권 */
          .shelf {
            gap: 0 12px; padding: 18px 14px 0;
            background-image: repeating-linear-gradient(
              to bottom,
              transparent 0, transparent 118px,
              var(--board1) 118px, var(--board2) 127px, var(--board3) 131px
            );
            background-size: 100% 131px;
          }
          .bookwrap { height: 131px; padding-bottom: 13px; }
          .book3d { width: 68px; height: 98px; }

          /* 사용법(첫 방문) 화면 모바일에서 컴팩트하게 */
          .modal { max-height: 88vh; }
          .intro-hero { padding: 22px 20px 18px; }
          .intro-emo { font-size: 36px; }
          .intro-hero h2 { font-size: 19px; }
          .intro-hero p { font-size: 13px; }
          .intro-list { padding: 12px 18px 2px; }
          .intro-list li { padding: 7px 0; }
          .intro-list li span { font-size: 20px; width: 26px; }
          .intro-list b { font-size: 13.5px; }
          .intro-list em { font-size: 12px; }
          .intro-warn { margin: 6px 18px 0; padding: 11px 13px; font-size: 12px; }
          .intro-cta { margin: 14px 18px 18px; width: calc(100% - 36px); padding: 13px; font-size: 14.5px; }

          /* 카메라 영상 높이 제한 */
          .reader { max-height: 60vh; }
          .reader :global(video) { max-height: 60vh; object-fit: cover; }

          /* 스캔 바: 버튼 두 개가 들어갈 자리 확보 */
          .scanbar { gap: 8px; padding: 12px 12px 12px 16px; }
          .beam { display: none; }
          .gobtn { padding: 0 14px; height: 44px; font-size: 14.5px; }
          .cambtn { width: 44px; height: 44px; font-size: 20px; }
          .scan { font-size: 16px; }
        }
      `}</style>
    </main>
  );
}
