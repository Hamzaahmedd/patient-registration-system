import type { NextFunction, Request, Response } from "express";

/**
 * Standard envelope required by the spec: { "data": ..., "error": null } on success.
 * Attaches `res.envelope(data, status)` so REST controllers never hand-roll the shape.
 *
 * Deliberately NOT applied to the voice-agent routes - Vapi expects a bare
 * `{ "result": "..." }` tool-response shape, not this envelope (see voice-controller.ts).
 */
declare module "express-serve-static-core" {
  interface Response {
    envelope: (data: unknown, status?: number) => Response;
  }
}

export function responseEnvelope(_req: Request, res: Response, next: NextFunction): void {
  res.envelope = function envelope(data: unknown, status = 200) {
    return this.status(status).json({ data, error: null });
  };
  next();
}
