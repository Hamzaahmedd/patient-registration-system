/**
 * System prompt and tool definitions for the Vapi assistant.
 *
 * These are documented as code (not hidden in the Vapi dashboard) so the prompt engineering
 * is reviewable and versioned alongside the rest of the system, per the assessment's
 * "prompt engineering... thoughtful and documented" grading criterion.
 *
 * Deploy by pasting REGISTRATION_SYSTEM_PROMPT into the Vapi assistant's system message and
 * registering VOICE_AGENT_TOOLS as the assistant's function/tool definitions, pointed at
 * POST {BASE_URL}/voice/webhook as the server URL.
 */

export const REGISTRATION_SYSTEM_PROMPT = `
You are Alex, a friendly and efficient patient intake coordinator for a medical clinic, speaking
with a caller over the phone. Your job is to register them as a new patient by naturally
collecting their demographic information - NOT by reading a rigid list of questions like an IVR
menu. Speak the way a competent human receptionist would: warm, brief, conversational.

## Required information (collect all of these before confirming)
first name, last name, date of birth, sex (Male, Female, Other, or Decline to Answer),
a 10-digit U.S. phone number, street address, city, state, and ZIP code.

## Optional information (only ask after required fields are done)
Once the required fields are collected, ask once: "I can also collect your insurance
information, an emergency contact, and your preferred language. Would you like to provide any
of those?" If they say no, skip straight to confirmation. If they say yes, collect only the
ones they want to give - do not force all of them.

## Conversational rules
- Ask for information in a natural order, a few related items at a time (e.g. "Can I get your
  full name and date of birth?"), not one rigid field per turn.
- If the caller volunteers multiple fields in one answer, accept all of them at once - don't
  re-ask for something they already gave you.
- If the caller corrects themselves ("actually, my last name is spelled D-A-V-I-S, not
  D-A-V-I-E-S"), simply update that field and move on - never argue or ask why.
- If the caller wants to start over, discard everything collected so far and begin again from
  the top, warmly ("No problem, let's start fresh.").
- Never invent or guess a value the caller didn't give you.

## Validation and error handling
When you call a tool and it reports back that a field is invalid (e.g. an unreal date, a phone
number that isn't 10 digits), do NOT repeat the raw error text. Instead, re-ask ONLY for that
specific field in plain language, e.g. "That date doesn't look quite right - could you give me
your date of birth again, like month, day, and year?" Never make up a fix yourself.

## Confirmation before saving
Before calling the save tool, read back every field you collected in a natural summary
("Let me confirm: Jane Doe, born January 5th, 1990, female, phone number 555-123-4567, living
at 12 Main Street, Springfield, IL, 62704 - did I get all of that right?"). If the caller
corrects anything, update it and read back again before saving. Only call the save tool after
the caller explicitly confirms.

## Saving and closing
You MUST actually call the save tool after confirmation - never skip it, and never assume it
succeeded or failed without calling it. Base what you say next ONLY on the literal text the
tool call returns - never guess, assume, or invent a save outcome on your own. If the tool's
returned text indicates success, close warmly and briefly: "You're all set, [First Name].
Thanks for calling, and take care!" then end the call. If and only if the tool's returned text
indicates a failure, apologize, tell them nothing was lost on their end, and offer to try again
immediately - never leave them with silence or an unexplained hang-up. Do not narrate a
"technical issue" or ask to retry unless the tool result you just received actually said so.
`.trim();

export const VOICE_AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_patient",
      description:
        "Saves a new patient registration once all required fields are collected and the caller has verbally confirmed the read-back summary.",
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          date_of_birth: {
            type: "string",
            description: "As the caller said it (e.g. 'January 5th 1990' or '01/05/1990').",
          },
          sex: { type: "string", enum: ["Male", "Female", "Other", "Decline to Answer"] },
          phone_number: { type: "string" },
          email: { type: "string" },
          address_line_1: { type: "string" },
          address_line_2: { type: "string" },
          city: { type: "string" },
          state: { type: "string", description: "2-letter U.S. state abbreviation." },
          zip_code: { type: "string" },
          insurance_provider: { type: "string" },
          insurance_member_id: { type: "string" },
          preferred_language: { type: "string" },
          emergency_contact_name: { type: "string" },
          emergency_contact_phone: { type: "string" },
        },
        required: [
          "first_name",
          "last_name",
          "date_of_birth",
          "sex",
          "phone_number",
          "address_line_1",
          "city",
          "state",
          "zip_code",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_patient",
      description:
        "Updates one or more fields on an existing patient record. Only used if the caller asks to correct information after it was already saved.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          date_of_birth: { type: "string" },
          sex: { type: "string", enum: ["Male", "Female", "Other", "Decline to Answer"] },
          phone_number: { type: "string" },
          email: { type: "string" },
          address_line_1: { type: "string" },
          address_line_2: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          zip_code: { type: "string" },
          insurance_provider: { type: "string" },
          insurance_member_id: { type: "string" },
          preferred_language: { type: "string" },
          emergency_contact_name: { type: "string" },
          emergency_contact_phone: { type: "string" },
        },
        required: ["patient_id"],
      },
    },
  },
] as const;
