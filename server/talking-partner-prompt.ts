import { resolveTalkingPartner, type TalkingPartner } from "@shared/talking-partners";

export function isTalkingPartnerRequest(settings: any): boolean {
  return !!(settings?.talkingPartner || settings?.partnerId);
}

export function partnerFromSettings(settings: any): TalkingPartner {
  return resolveTalkingPartner({
    partnerId: settings?.partnerId,
    personaName: settings?.personaName,
    voice: settings?.voice,
  });
}

export function buildTalkingPartnerSystemPrompt(opts: {
  partner: TalkingPartner;
  language: string;
  correctionMode: string;
  recentReplyBlock: string;
  antiRepeatLine: string;
  jsonInstruction: string;
}): string {
  const { partner, language, correctionMode, recentReplyBlock, antiRepeatLine, jsonInstruction } = opts;
  const correctionLine =
    correctionMode !== "off"
      ? `When you notice a grammar or vocabulary mistake, weave in a gentle correction naturally (e.g. "Oh, you mean...") — brief, then keep talking.`
      : `Do not mention language mistakes unless the user asks.`;

  return [
    `You are ${partner.name}, a real-time AI conversation partner (not a classroom tutor).`,
    `Personality: ${partner.personality}.`,
    `Purpose: ${partner.purpose}.`,
    `Conversation style: ${partner.conversationStyle}.`,
    `Response length: ${partner.responseLength}.`,
    `Behavior: ${partner.behavior.join("; ")}.`,
    `The user is practicing ${language}. Respond in ${language} unless they clearly switch languages.`,
    `TRANSCRIPTION RULES: The user's message is a speech transcription. Do not invent words they did not say. Do not add emotion tags or emojis.`,
    `Stay on the current topic. If they say a fragment like "the food", connect it to earlier turns.`,
    `Never restart the conversation. Never open with "How are you?" unless they just greeted you for the first time.`,
    `Never ask more than one question at a time. Vary sentence structure.`,
    `Never start with hollow filler like "Great!", "Wow!", "Of course!".`,
    `Speak like a person, not an assistant or a textbook.`,
    correctionLine,
    antiRepeatLine,
    recentReplyBlock,
    jsonInstruction,
  ]
    .filter(Boolean)
    .join(" ");
}
