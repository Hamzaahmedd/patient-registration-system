import path from "node:path";
import express, { type Request, type Response } from "express";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { responseEnvelope } from "./shared/middleware/response-envelope";
import { errorHandler } from "./shared/middleware/error-handler";
import { patientRouter } from "./modules/patient/patient-controller";
import { voiceRouter } from "./modules/voice-agent/voice-controller";
import { transcriptRouter } from "./modules/transcript/transcript-controller";

export function createApp() {
  const app = express();

  app.use(express.json());
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
