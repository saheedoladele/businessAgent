/**
 * Voice provider interface. Default is "manual": the agent prepares the
 * call (script + WhatsApp message) and YOU make it. Set VOICE_PROVIDER=vapi
 * to let an AI voice agent place calls instead (see vapi.ts for the rules).
 */

export interface StartCallInput {
  to: string; // E.164
  script: string;
  variables: Record<string, string>; // company, contact, booking link...
  metadata: Record<string, string>; // ids we want back in webhooks
}

export interface VoiceProvider {
  name: "manual" | "vapi";
  /** True when calls are placed automatically (vs. tasks for a human). */
  automatic: boolean;
  startCall(input: StartCallInput): Promise<{ callId: string }>;
}

const manual: VoiceProvider = {
  name: "manual",
  automatic: false,
  async startCall() {
    throw new Error("Manual provider: calls are made by a person from the call task list");
  },
};

export async function voiceProvider(): Promise<VoiceProvider> {
  if (process.env.VOICE_PROVIDER === "vapi") {
    const { vapiProvider } = await import("./vapi");
    return vapiProvider();
  }
  return manual;
}
