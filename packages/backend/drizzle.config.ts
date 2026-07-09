import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "dialclear",
    user: process.env.DB_USER || "dialclear",
    password: process.env.DB_PASSWORD || "dialclear",
  },
} satisfies Config;
