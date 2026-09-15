import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../../config/logger";

/** Base class for errors that map to a specific HTTP status + envelope error shape. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

function toErrorBody(err: AppError | Error) {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, details: err.details ?? null };
  }
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", details: null };
}

/**
 * Express error-handling middleware (4-arg signature required by Express to be recognized as such).
 * Every REST response - success or failure - goes through the { data, error } envelope.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const validationError = new ValidationError("Request validation failed.", err.flatten());
    logger.warn({ err: validationError.details, path: req.path }, "validation_error");
    res.status(422).json({ data: null, error: toErrorBody(validationError) });
    return;
  }

  if (err instanceof AppError) {
    const level = err.status >= 500 ? "error" : "warn";
    logger[level]({ err: err.message, path: req.path }, "app_error");
    res.status(err.status).json({ data: null, error: toErrorBody(err) });
    return;
  }

  logger.error({ err, path: req.path }, "unhandled_error");
  res.status(500).json({ data: null, error: toErrorBody(err as Error) });
}
