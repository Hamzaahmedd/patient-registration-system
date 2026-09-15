import path from "node:path";
import express, { type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { responseEnvelope } from "./shared/middleware/response-envelope";
import { errorHandler } from "./shared/middleware/error-handler";
import { patientRouter } from "./modules/patient/patient-controller";
import { voiceRouter } from "./modules/voice-agent/voice-controller";
import { transcriptRouter } from "./modules/transcript/transcript-controller";

export function createApp() {
  const app = express();

  // Allows the frontend dashboard (a separate origin/port) to call this API directly - see
  // env.corsOrigins / CORS_ORIGINS. The Vite dev proxy avoids needing this in local dev, but a
  // production frontend build served from its own origin (or VITE_API_BASE_URL pointing here
  // directly) requires it.
  app.use(
    cors({
      origin: env.corsOrigins,
    }),
  );

  // `verify` stashes the exact raw bytes of the request body on req.rawBody before Express
  // parses it - needed to verify Vapi's HMAC webhook signature, which is computed over the raw
  // body text. Re-serializing the parsed JSON would not reliably reproduce the same bytes
  // (whitespace/key-order can differ), so the signature check needs this raw copy specifically.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ data: { status: "ok" }, error: null });
  });

  // REST API - envelope-wrapped, per spec.
  app.use("/patients", responseEnvelope, patientRouter);
  app.use("/transcripts", responseEnvelope, transcriptRouter);

  // Vapi webhook - intentionally bypasses the REST envelope (see voice-controller.ts).
  app.use("/voice", voiceRouter);

  // Read-only dashboard (bonus) - static assets only, fetches GET /patients client-side.
  app.use("/dashboard", express.static(path.join(__dirname, "../public/dashboard")));

  app.use((req: Request, res: Response) => {
    res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}`, details: null } });
  });

  app.use(errorHandler);

  return app;
}
