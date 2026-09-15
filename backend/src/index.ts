import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { disconnectDatabase } from "./config/database";

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, "server_started");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting_down");
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
