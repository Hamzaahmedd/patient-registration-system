import pino from "pino";
import { env } from "./env";
import { PINO_REDACT_PATHS } from "../shared/utils/pii-sanitizer";

// Plain structured JSON output (no pino-pretty dependency) - kept dependency-light
// for the zero-cost/time-boxed build; still perfectly readable via `| npx pino-pretty` locally.
export const logger = pino({
  level: env.nodeEnv === "test" ? "silent" : "info",
  redact: {
    paths: PINO_REDACT_PATHS,
    censor: "[REDACTED]",
  },
});
