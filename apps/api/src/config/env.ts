import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Compute __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 优先加载 apps/api/.env，再加载仓库根的 .env，最后使用默认 dotenv 行为
const localEnv = path.resolve(__dirname, "../../.env");
const rootEnv = path.resolve(process.cwd(), ".env");
let dotenvLoaded = false;

if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
  dotenvLoaded = true;
}

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: true });
  dotenvLoaded = true;
}

if (!dotenvLoaded) {
  dotenv.config({ override: true });
}
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  AI_PROVIDER: z
    .enum(["mock", "openai-compatible", "gemini"])
    .default("mock"),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(10_000).max(300_000).default(90_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  SSE_HEARTBEAT_MS: z.coerce.number().int().min(5_000).max(60_000).default(15_000)
});

export const env = envSchema.parse(process.env);

export const allowedOrigins = env.WEB_ORIGIN.split(",").map((origin) =>
  origin.trim()
);
