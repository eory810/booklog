# 내 서재 — 바코드 스캔 도서 관리

바코드 스캐너로 책을 찍으면 → 카카오 책 검색 API로 제목·저자·표지를 가져와 → PostgreSQL에 저장 → 목록으로 보여주는 Next.js 앱.

- **표지/서지 조회:** 카카오 책 검색 API (1순위) + 국립중앙도서관 ISBN 서지정보 (선택 폴백)
- **저장:** PostgreSQL (`books` 테이블, ISBN 기준 upsert → 중복 자동 방지)
- **배포:** Netlify (Next.js API 라우트가 서버리스 함수로 자동 실행 → API 키 노출 없음)

---

## 폴더 구조

```
booklog/
├─ app/
│  ├─ layout.tsx            # 기본 레이아웃
│  ├─ page.tsx              # 화면(스캔 입력 + 목록)
│  └─ api/
│     ├─ book/route.ts      # ISBN → 책정보 조회 (카카오/국중도)  ← 벤더는 여기에만
│     └─ books/route.ts     # 서재 저장/조회/삭제 (PostgreSQL)
├─ lib/db.ts                # DB 연결
├─ schema.sql               # 테이블 생성 SQL
├─ .env.local.example       # 환경변수 예시
├─ netlify.toml             # Netlify 빌드 설정
├─ next.config.mjs
├─ tsconfig.json
└─ package.json
```

---

## 0. 준비물

- Node.js 18 이상
- USB 바코드 스캐너 (드라이버 없이 키보드처럼 인식됨)
- GitHub 계정, Netlify 계정
- (DB) Neon 계정 — 무료 서버리스 PostgreSQL

---

## 1. 카카오 REST API 키 발급

1. https://developers.kakao.com 로그인
2. **내 애플리케이션 → 애플리케이션 추가하기** (앱 이름·사업자명 아무거나)
3. 만든 앱 클릭 → **앱 키** 탭 → **REST API 키** 복사
4. 이 키는 **비밀값**입니다. 공개 저장소나 클라이언트 코드에 넣지 말 것. (아래에서 서버 환경변수로만 씁니다.)

> 이미 이 키를 채팅·공개된 곳에 노출한 적이 있으면, 카카오 앱 키 화면에서 **재발급**해 두세요.

---

## 2. PostgreSQL 준비 (Neon)

1. https://neon.tech 가입 → **Create project**
2. 프로젝트 생성 후 **Connection string** 에서 **Pooled connection** 문자열을 복사
   (형태: `postgresql://user:pass@ep-xxxx-pooler.../dbname?sslmode=require`)
3. 왼쪽 **SQL Editor** 열기 → `schema.sql` 내용을 붙여넣고 **Run**
   → `books` 테이블 생성 완료

> 로컬 PostgreSQL을 써도 됩니다. 그 경우 `schema.sql` 을 `psql -d booklog -f schema.sql` 로 실행하세요.

---

## 3. 로컬에서 실행

```bash
# 이 폴더에서
npm install

# 환경변수 파일 생성
cp .env.local.example .env.local
```

`.env.local` 을 열어 채웁니다:

```
KAKAO_REST_API_KEY=1단계에서_복사한_키
NL_CERT_KEY=                      # 비워둬도 됨(선택)
DATABASE_URL=2단계에서_복사한_Neon_Pooled_문자열
```

실행:

```bash
npm run dev
```

→ 브라우저에서 http://localhost:3000 접속
→ 입력창에 커서를 두고 스캐너로 책을 찍으면 표지와 함께 목록에 쌓입니다.
(스캐너 없이 ISBN을 직접 입력하고 Enter 쳐도 됩니다. 예: `9788937460777`)

---

## 4. GitHub에 올리기

```bash
git init
git add .
git commit -m "book scanner"
git branch -M main
git remote add origin https://github.com/<본인계정>/booklog.git
git push -u origin main
```

> `.gitignore` 에 `.env.local` 이 들어 있어 키는 커밋되지 않습니다.

---

## 5. Netlify 배포

1. https://app.netlify.com → **Add new site → Import an existing project**
2. GitHub 연결 → `booklog` 저장소 선택
3. 빌드 설정은 자동 감지됩니다 (Next.js). 그대로 **Deploy**
4. **Site configuration → Environment variables** 에서 아래 3개를 추가:
   - `KAKAO_REST_API_KEY` = 카카오 키
   - `NL_CERT_KEY` = (선택, 없으면 생략)
   - `DATABASE_URL` = Neon Pooled 문자열
5. 환경변수 저장 후 **Deploys → Trigger deploy → Deploy site** 로 재배포
6. 발급된 주소(`https://<사이트>.netlify.app`)로 접속 → 완료

> Vercel을 써도 동일합니다. import 후 같은 환경변수 3개만 넣으면 됩니다.

---

## 동작 흐름 요약

```
스캔 → /api/book?isbn=      (서버가 카카오 호출, 실패 시 국중도 폴백)
     → /api/books  POST     (PostgreSQL upsert 저장)
     → 화면 목록 갱신        (표지 이미지 렌더)
```

## 자주 겪는 문제

- **표지가 안 나와요:** 카카오에 없는 책일 수 있습니다. `NL_CERT_KEY` 를 넣으면 국립중앙도서관에서 보완합니다. 그래도 없으면 제목을 눌러 직접 입력하세요.
- **목록이 안 뜨고 비어 있어요:** `DATABASE_URL` 이 틀렸거나 `schema.sql` 을 아직 안 돌렸을 가능성. 2단계를 확인하세요.
- **`missing_api_key` 오류:** 환경변수를 저장한 뒤 재배포(또는 `npm run dev` 재시작)를 안 한 경우입니다.
- **API를 또 바꿔야 한다면:** `app/api/book/route.ts` **한 파일만** 고치면 됩니다. 응답 형태(`title/author/publisher/pubDate/cover`)만 맞추면 화면·DB는 그대로 동작합니다.
