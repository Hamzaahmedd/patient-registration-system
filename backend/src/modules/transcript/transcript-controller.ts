import { Router, type NextFunction, type Request, type Response } from "express";
import { getTranscriptById, listAllTranscripts, resolveRecordingRedirectUrl } from "./transcript-service";

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

// GET /transcripts/:id/recording - resolves an authenticated, short-lived playback URL for the
// call recording and redirects the browser straight to it. Deliberately NOT envelope-wrapped
// (this is consumed as a plain URL by an <audio> tag / direct navigation, not fetched as JSON)
// and never returns the recording bytes itself - Vapi's private API key used to resolve this
// stays server-side the whole time; only the resulting short-lived signed URL reaches the client.
transcriptRouter.get(
  "/:id/recording",
  asyncHandler(async (req, res) => {
    const transcript = await getTranscriptById(req.params.id);
    // recording_url (not vapi_call_id, which is always present) is what tells us Vapi actually
    // recorded this call - skip the API round-trip entirely if it never told us there was one.
    if (!transcript.recording_url) {
      res.status(404).send("No recording available for this transcript.");
      return;
    }
    const redirectUrl = await resolveRecordingRedirectUrl(transcript.vapi_call_id);
    res.redirect(302, redirectUrl);
  }),
);
