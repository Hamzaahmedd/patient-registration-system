import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import {
  handleCreatePatientTool,
  handleLookupPatientByPhoneTool,
  handleUpdatePatientTool,
} from "./voice-service";

/**
 * Vapi tool-call webhook. Deliberately NOT wrapped in the { data, error } REST envelope
 * (response-envelope.ts is never applied to this router) - Vapi expects a bare
 * `{ "results": [{ "toolCallId": ..., "result": "..." }] }` shape and speaks `result`
 * directly to the caller, so it must stay a plain string, not a nested API error object.
 */
export const voiceRouter = Router();

interface VapiToolCall {
  id: string;
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
}

interface VapiWebhookBody {
  message?: {
    type?: string;
    toolCallList?: VapiToolCall[];
  };
}

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
  lookup_patient_by_phone: handleLookupPatientByPhoneTool,
  create_patient: handleCreatePatientTool,
  update_patient: handleUpdatePatientTool,
};

function verifyWebhookSecret(req: Request): boolean {
  if (!env.vapi.webhookSecret) return true; // not configured -> skip check (documented in README)
  const provided = req.header("x-vapi-secret");
  return provided === env.vapi.webhookSecret;
}

function parseArguments(raw: VapiToolCall["function"]["arguments"]): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

voiceRouter.post("/webhook", async (req: Request, res: Response, _next: NextFunction) => {
  if (!verifyWebhookSecret(req)) {
    res.status(401).json({ results: [] });
    return;
  }

  const body = req.body as VapiWebhookBody;
  const toolCalls = body.message?.toolCallList ?? [];

  if (toolCalls.length === 0) {
    // Not a tool-call event (e.g. a status-update webhook) - acknowledge and ignore.
    res.status(200).json({ received: true });
    return;
  }

  // Top-level guard: handleCreatePatientTool/handleUpdatePatientTool already catch their own
  // DB/validation errors and return a speakable message, but this catches anything unforeseen
  // (a bug, an unexpected payload shape) so the call always gets a spoken response instead of
  // hanging or dropping - "graceful degradation" applies to the whole webhook, not just the
  // expected failure paths.
  try {
    const results = await Promise.all(
      toolCalls.map(async (call) => {
        const handler = TOOL_HANDLERS[call.function.name];
        if (!handler) {
          logger.warn({ tool: call.function.name }, "unknown_voice_tool_call");
          return { toolCallId: call.id, result: "Sorry, I can't do that right now." };
        }
        const args = parseArguments(call.function.arguments);
        const result = await handler(args);
        return { toolCallId: call.id, result };
      }),
    );
    res.status(200).json({ results });
  } catch (error) {
    logger.error({ err: error }, "voice_webhook_unhandled_error");
    const fallbackResults = toolCalls.map((call) => ({
      toolCallId: call.id,
      result: "I'm sorry, something went wrong on our end. Could we try that again?",
    }));
    res.status(200).json({ results: fallbackResults });
  }
});
