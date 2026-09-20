export type ReplyRequest = {
  platform: string;
  conversationTitle: string;
  conversationCategory: "work" | "personal";
  messages: Array<{ direction: "inbound" | "outbound"; senderName?: string; body: string; sentAt: string }>;
  styleExamples: string[];
  styleNotes?: string;
  memory: Array<{ key: string; value: string }>;
  settings: { mode: string; simulationEnabled: boolean };
};

export type ReplyResult = {
  reply: string;
  language: string;
  confidence: number;
  reason: string;
  recommended_action: "draft" | "approve" | "send" | "skip";
  engine: "openai" | "local-heuristic";
};

const SKIP_MARKERS = [/unsubscribe/i, /no-?reply/i, /do not reply/i, /this is an automated/i];

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 800);
  if (/[\u0600-\u06FF]/.test(sample)) return "ar";
  if (/[\u0400-\u04FF]/.test(sample)) return "ru";
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(sample)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(sample) && !/[\u3040-\u30FF]/.test(sample)) return "zh";
  if (/[\uAC00-\uD7AF]/.test(sample)) return "ko";
  if (/[àâçéèêëîïôùûüÿœæ]/i.test(sample) && /\b(le|la|les|je|tu|vous|merci)\b/i.test(sample)) return "fr";
  if (/[áéíóúñ¿¡]/i.test(sample) && /\b(el|la|que|gracias|hola)\b/i.test(sample)) return "es";
  if (/\b(der|die|das|und|nicht|danke)\b/i.test(sample)) return "de";
  if (/\b(the|and|you|thanks|please)\b/i.test(sample)) return "en";
  return "en";
}

export function qualityCheck(reply: string, incoming: string): { ok: boolean; reason: string } {
  const text = reply.trim();
  if (text.length < 2) return { ok: false, reason: "Empty reply" };
  if (text.length > 2000) return { ok: false, reason: "Reply too long" };
  if (SKIP_MARKERS.some((re) => re.test(incoming))) return { ok: false, reason: "Looks like an automated/no-reply message" };
  if (/(ignore previous instructions|system prompt)/i.test(text)) return { ok: false, reason: "Unsafe model output" };
  return { ok: true, reason: "Passed quality checks" };
}

function lastInbound(messages: ReplyRequest["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "inbound") return messages[i].body;
  }
  return messages.at(-1)?.body || "";
}

function heuristicReply(input: ReplyRequest): ReplyResult {
  const incoming = lastInbound(input.messages);
  const language = detectLanguage(incoming);
  const style = input.styleExamples.filter((s) => s.trim()).slice(0, 5);
  const memoryBits = input.memory.slice(0, 4).map((m) => `${m.key}: ${m.value}`).join("; ");
  let reply: string;
  if (style.length) {
    const voice = style[0].trim();
    const firstLine = voice.split(/\n/)[0]?.slice(0, 180) || voice.slice(0, 180);
    reply = `${acknowledge(language, incoming)} ${shortAnswer(incoming, language)}`;
    if (firstLine && firstLine.length < 120 && !/[?]/.test(firstLine)) {
      reply = `${reply} ${firstLine}`.trim();
    }
  } else {
    reply = `${acknowledge(language, incoming)} ${shortAnswer(incoming, language)}`;
  }
  if (memoryBits) reply = reply.trim();
  const quality = qualityCheck(reply, incoming);
  return {
    reply: reply.trim(),
    language,
    confidence: style.length ? 0.55 : 0.4,
    reason: quality.ok
      ? "Local heuristic draft from conversation text and your style examples. Not sent."
      : quality.reason,
    recommended_action: quality.ok ? (input.settings.mode === "auto" ? "send" : "approve") : "skip",
    engine: "local-heuristic",
  };
}

function acknowledge(language: string, incoming: string): string {
  if (language === "es") return "Gracias por el mensaje.";
  if (language === "fr") return "Merci pour ton message.";
  if (language === "de") return "Danke für die Nachricht.";
  if (language === "ar") return "شكراً على رسالتك.";
  if (/\?/.test(incoming)) return "Thanks for writing —";
  return "Thanks,";
}

function shortAnswer(incoming: string, language: string): string {
  if (/\?/.test(incoming)) {
    if (language === "es") return "Lo reviso y te confirmo.";
    if (language === "fr") return "Je vérifie et je te confirme.";
    return "I'll check and follow up.";
  }
  if (language === "es") return "Lo tengo presente.";
  if (language === "fr") return "C'est noté.";
  return "Got it.";
}

export async function generateReply(
  input: ReplyRequest,
  openai?: { apiKey?: string; baseUrl: string; model: string },
  fetchFn: typeof fetch = fetch,
): Promise<ReplyResult> {
  const incoming = lastInbound(input.messages);
  if (!incoming.trim()) {
    return {
      reply: "",
      language: "en",
      confidence: 0,
      reason: "No inbound text to reply to",
      recommended_action: "skip",
      engine: "local-heuristic",
    };
  }
  const qualityIncoming = qualityCheck("placeholder", incoming);
  if (!qualityIncoming.ok && /automated|no-reply/i.test(qualityIncoming.reason)) {
    return {
      reply: "",
      language: detectLanguage(incoming),
      confidence: 0,
      reason: qualityIncoming.reason,
      recommended_action: "skip",
      engine: "local-heuristic",
    };
  }
  if (!openai?.apiKey) return heuristicReply(input);

  const transcript = input.messages
    .slice(-12)
    .map((m) => `${m.direction === "inbound" ? m.senderName || "Them" : "Me"}: ${m.body}`)
    .join("\n");
  const examples = input.styleExamples.filter(Boolean).slice(0, 8).map((e, i) => `${i + 1}. ${e}`).join("\n") || "(none provided)";
  const memory = input.memory.map((m) => `- ${m.key}: ${m.value}`).join("\n") || "(none)";
  const system = `You draft a short reply as the user, matching their writing style examples. Reply in the same language as the latest inbound message. Do not reveal chain-of-thought. Do not claim you already sent anything. Output JSON only: {"reply":"...","language":"bcp47","confidence":0-1,"reason":"short","recommended_action":"draft"|"approve"|"send"|"skip"}`;
  const user = `Platform: ${input.platform}
Conversation: ${input.conversationTitle} (${input.conversationCategory})
Mode: ${input.settings.mode}; simulation: ${input.settings.simulationEnabled}

Style examples (user's own words):
${examples}

Notes: ${input.styleNotes || ""}

Memory:
${memory}

Transcript:
${transcript}`;

  const res = await fetchFn(`${openai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openai.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const fallback = heuristicReply(input);
    fallback.reason = `OpenAI-compatible endpoint returned ${res.status}; used local heuristic instead.`;
    fallback.confidence = Math.min(fallback.confidence, 0.35);
    return fallback;
  }
  const json = (await res.json()) as any;
  const content = json.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(content);
  if (!parsed) {
    const fallback = heuristicReply(input);
    fallback.reason = "Model did not return JSON; used local heuristic.";
    return fallback;
  }
  const quality = qualityCheck(parsed.reply, incoming);
  if (!quality.ok) {
    return { ...parsed, recommended_action: "skip", reason: quality.reason, engine: "openai" };
  }
  return { ...parsed, engine: "openai" };
}

function parseModelJson(content: string): Omit<ReplyResult, "engine"> | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (typeof obj.reply !== "string") return null;
    return {
      reply: obj.reply.trim(),
      language: typeof obj.language === "string" ? obj.language : "en",
      confidence: Number(obj.confidence ?? 0.5),
      reason: typeof obj.reason === "string" ? obj.reason : "Model draft",
      recommended_action: ["draft", "approve", "send", "skip"].includes(obj.recommended_action)
        ? obj.recommended_action
        : "approve",
    };
  } catch {
    return null;
  }
}
