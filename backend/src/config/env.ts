import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requireEnv("DATABASE_URL"),
  vapi: {
    apiKey: process.env.VAPI_API_KEY ?? "",
    webhookSecret: process.env.VAPI_WEBHOOK_SECRET ?? "",
  },
};

export const isProduction = env.nodeEnv === "production";
