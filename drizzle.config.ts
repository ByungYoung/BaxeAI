import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// PostgreSQL URL에서 필요한 정보 추출
const connectionString = process.env.POSTGRES_PRISMA_URL || '';
let dbHost = 'localhost';
let dbPort = 5432;
let dbName = 'postgres';
let dbUser = '';
let dbPassword = '';
let dbSsl = false;

// connectionString이 존재할 경우 파싱 시도
if (connectionString) {
  try {
    const url = new URL(connectionString);
    dbHost = url.hostname;
    dbPort = parseInt(url.port || '5432');
    dbName = url.pathname.substring(1); // '/dbname' -> 'dbname'
    dbUser = decodeURIComponent(url.username);
    dbPassword = decodeURIComponent(url.password);
    dbSsl = url.searchParams.get('sslmode') === 'require';
  } catch (e) {
    console.error('Failed to parse database connection string', e);
  }
}

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: dbSsl,
  },
  strict: true,
} satisfies Config;
