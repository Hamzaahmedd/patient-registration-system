import { Router, type NextFunction, type Request, type Response } from "express";
import { listAllTranscripts } from "./transcript-service";

/** Wraps an async route handler so rejected promises reach the error-handler middleware. */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export const transcriptRouter = Router();

// GET /transcripts - global call transcript log, for the dashboard. Envelope-wrapped like
// every other REST route (see app.ts mounting).
transcriptRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const transcripts = await listAllTranscripts();
    res.envelope(transcripts, 200);
  }),
);
