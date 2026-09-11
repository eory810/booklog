import { Pool } from "pg";

// 로컬(localhost)은 SSL 끄고, 클라우드(Neon 등)는 SSL 켬
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "");

// 서버리스(Netlify 함수)에서 연결 폭증을 막으려 전역에 풀을 캐시
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export const query = (text: string, params?: any[]) => pool.query(text, params);
