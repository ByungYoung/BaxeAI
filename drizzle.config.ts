import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// 환경 변수 로드
dotenv.config();

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    connectionString: process.env.POSTGRES_PRISMA_URL || "",
  },
  strict: true,
} satisfies Config;
