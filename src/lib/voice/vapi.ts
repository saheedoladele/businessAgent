import type { VoiceProvider } from "./index";

/**
 * EXPERIMENTAL: outbound AI calls through Vapi (https://vapi.ai).
 *
 * Legal guard rails (read before enabling):
 * - In the US, AI-voice calls count as "artificial voice" calls under the
 *   TCPA and generally need the person's prior express consent. The UK/EU
 *   and Nigeria have their own direct-marketing rules.
 * - So LeadHunter only lets the AI call leads who already replied
 *   positively (status INTERESTED), never cold NEEDS_CALL leads, and only
 *   when you set VAPI_CONSENT_ACKNOWLEDGED=true.
 * - Configure your Vapi assistant to say it's an AI assistant calling on
 *   your behalf at the start of every call.
 *
 * Setup in Vapi: create an assistant (use {{company}}, {{contactName}},
 * {{bookingUrl}}, {{script}} variables in its prompt) and buy/import a phone
 * number, then set VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID.
 */
export function vapiProvider(): VoiceProvider {
  const { VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID, VAPI_CONSENT_ACKNOWLEDGED } = process.env;
  if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
    throw new Error("VOICE_PROVIDER=vapi needs VAPI_API_KEY, VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID");
  }
  if (VAPI_CONSENT_ACKNOWLEDGED !== "true") {
    throw new Error("Set VAPI_CONSENT_ACKNOWLEDGED=true once you've checked AI calling is lawful for your leads");
  }

  return {
    name: "vapi",
    automatic: true,
    async startCall({ to, script, variables, metadata }) {
      const res = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { authorization: `Bearer ${VAPI_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          customer: { number: to },
          assistantOverrides: { variableValues: { ...variables, script } },
          metadata,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Vapi ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const call = (await res.json()) as { id: string };
      return { callId: call.id };
    },
  };
}
