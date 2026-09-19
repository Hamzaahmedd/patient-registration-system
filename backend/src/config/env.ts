import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Comma-separated list of origins allowed to call the REST API cross-origin (the frontend
// dashboard in local dev, and wherever it's deployed). Defaults cover Vite's default dev port
// under both localhost and 127.0.0.1.
const DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requireEnv("DATABASE_URL"),
  corsOrigins: (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  vapi: {
    webhookSecret: process.env.VAPI_WEBHOOK_SECRET ?? "",
    // Private API key - needed only to resolve authenticated call-recording URLs (Vapi moved
    // recording storage behind an authenticated endpoint; the plain URL in the webhook payload
    // is no longer directly fetchable). Never sent to the frontend - see transcript-service.ts.
    apiKey: process.env.VAPI_API_KEY ?? "",
  },
};

export const isProduction = env.nodeEnv === "production";
