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

const ASSISTANT_VOICE =
  /\b(great question|happy to help|as an ai|let me know if you (need|have)|thanks for writing|thanks for reaching out|i('ll| will) check and follow up|is there anything else|how can i (help|assist)|i hope this helps|certainly!?|absolutely,? i('d| would)|gracias por el mensaje|merci pour ton message|danke für die nachricht)\b/i;

const ACK_ONLY =
  /^(ok|okay|k|kk|yes|yep|yeah|yup|thanks|thank you|ty|thx|thanx|lol|lmao|haha|hehe|nice|cool|got it|thanks,?\s*got it|np|no problem|sure|ok sure|mm+|mhm|uh huh|right)[\s!.]*$/i;

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 1200);
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
  if (text.length > 280) return { ok: false, reason: "Reply too long for chat" };
  if (SKIP_MARKERS.some((re) => re.test(incoming))) return { ok: false, reason: "Looks like an automated/no-reply message" };
  if (/(ignore previous instructions|system prompt)/i.test(text)) return { ok: false, reason: "Unsafe model output" };
  if (ASSISTANT_VOICE.test(text)) return { ok: false, reason: "Assistant voice; rewrite as a companion" };
  if (/\b(as an ai|i am an ai|language model)\b/i.test(text)) return { ok: false, reason: "Assistant voice; rewrite as a companion" };
  return { ok: true, reason: "Passed quality checks" };
}

export function lastInbound(messages: ReplyRequest["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "inbound") return messages[i].body;
  }
  return messages.at(-1)?.body || "";
}

export function shouldSkipReply(incoming: string, messages: ReplyRequest["messages"] = []): { skip: boolean; reason: string } {
  const text = incoming.trim();
  if (!text) return { skip: true, reason: "No inbound text to reply to" };
  if (SKIP_MARKERS.some((re) => re.test(text))) {
    return { skip: true, reason: "No reply needed — automated or no-reply traffic." };
  }
  if (ACK_ONLY.test(text)) {
    return { skip: true, reason: "No reply needed — it was just an ack." };
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3 && !/[?]/.test(text) && text.length < 18) {
    return { skip: true, reason: "No reply needed — a short fragment, not a turn to answer." };
  }
  const inbounds = messages.filter((m) => m.direction === "inbound");
  const previousSame = inbounds.slice(0, -1).some((m) => m.body.trim() === text);
  if (previousSame) {
    return { skip: true, reason: "No reply needed — same line already in the room." };
  }
  return { skip: false, reason: "" };
}

function roomTranscript(messages: ReplyRequest["messages"]): string {
  return messages
    .slice(-24)
    .map((m) => m.body)
    .join("\n");
}

function heuristicReply(input: ReplyRequest): ReplyResult {
  const incoming = lastInbound(input.messages);
  const skip = shouldSkipReply(incoming, input.messages);
  const language = detectLanguage(`${incoming}\n${roomTranscript(input.messages)}`);
  if (skip.skip) {
    return {
      reply: "",
      language,
      confidence: 0.7,
      reason: skip.reason,
      recommended_action: "skip",
      engine: "local-heuristic",
    };
  }
  const style = input.styleExamples.filter((s) => s.trim()).slice(0, 5);
  let reply = companionLines(incoming, language, input.messages);
  const styleLine = style[0]?.trim().split(/\n/)[0]?.slice(0, 80);
  if (styleLine && styleLine.length < 70 && !/[?]/.test(styleLine) && !ASSISTANT_VOICE.test(styleLine)) {
    // Use their cadence, not their biography — never append a style line that looks like a personal fact.
    if (/^(yeah|nah|ok|mm|ha)/i.test(styleLine)) {
      reply = `${styleLine.replace(/\.$/, "")}. ${reply}`.trim();
    }
  }
  reply = reply.replace(/\s+/g, " ").trim();
  const quality = qualityCheck(reply, incoming);
  if (!quality.ok) {
    return {
      reply: "",
      language,
      confidence: 0.2,
      reason: quality.reason,
      recommended_action: "skip",
      engine: "local-heuristic",
    };
  }
  return {
    reply,
    language,
    confidence: style.length ? 0.62 : 0.52,
    reason: whyThisReply(incoming, input.messages),
    recommended_action: input.settings.mode === "auto" ? "send" : "approve",
    engine: "local-heuristic",
  };
}

function whyThisReply(incoming: string, messages: ReplyRequest["messages"]): string {
  if (/[?]/.test(incoming) || /^(what|who|where|when|why|how|do you|did you|can you)\b/i.test(incoming.trim())) {
    return "They asked; kept it short in the same language, no made-up facts.";
  }
  const others = messages.filter((m) => m.direction === "inbound").slice(-4);
  if (others.length > 1) {
    return "Read the visible room, then a present one-line reaction — companion voice, not a helper script.";
  }
  return "They’re sharing — a present reaction in their language, not an assistant wrap-up.";
}

function companionLines(
  incoming: string,
  language: string,
  messages: ReplyRequest["messages"],
): string {
  const lower = incoming.toLowerCase();
  const asked = /[?]/.test(incoming) || /^(what|who|where|when|why|how|do you|did you|can you|could you)\b/i.test(incoming.trim());
  const line = (en: string, es: string, fr: string) => (language === "es" ? es : language === "fr" ? fr : en);

  if (asked && /\b(time|meet|tomorrow|cuando|heure)\b/i.test(lower)) {
    return line(
      "I don’t want to invent a time — when were you thinking?",
      "No quiero inventar la hora — ¿qué momento tenías en mente?",
      "Je ne vais pas inventer l’heure — tu pensais à quand ?",
    );
  }
  if (asked) {
    return line(
      "I don’t want to guess. What do you think?",
      "No quiero adivinar. ¿Tú qué crees?",
      "Je ne veux pas deviner. Toi, tu en penses quoi ?",
    );
  }
  if (/\b(forgot|forget|can't remember|cannot remember|olvid)/i.test(lower)) {
    return line(
      "The name always leaves right as you reach for it.",
      "El nombre se escapa justo cuando lo quieres.",
      "Le nom file pile au moment où tu le cherches.",
    );
  }
  if (/\b(song|music|sing|lyrics|melody)\b/i.test(lower)) {
    return line(
      "Some of those stay in your head even without the title.",
      "Algunas se quedan en la cabeza aunque no salga el título.",
      "Certaines restent dans la tête même sans le titre.",
    );
  }
  if (/\b(good|great|fun|love|enjoy|was good|felt)\b/i.test(lower)) {
    return line(
      "Yeah — that kind of thing lingers.",
      "Sí — esas cosas se quedan un rato.",
      "Ouais — ce genre de truc reste.",
    );
  }
  const recentThem = messages
    .filter((m) => m.direction === "inbound")
    .slice(-3)
    .map((m) => m.body.trim())
    .join(" ");
  if (recentThem.length > 40) {
    return line(
      "I’m here. That detail stuck with you.",
      "Estoy aquí. Ese detalle se te quedó.",
      "Je suis là. Ce détail t’est resté.",
    );
  }
  return line("I’m with you on that.", "Te sigo en eso.", "Je te suis là-dessus.");
}

export async function generateReply(
  input: ReplyRequest,
  openai?: { apiKey?: string; baseUrl: string; model: string },
  fetchFn: typeof fetch = fetch,
): Promise<ReplyResult> {
  const incoming = lastInbound(input.messages);
  const skip = shouldSkipReply(incoming, input.messages);
  if (skip.skip) {
    return {
      reply: "",
      language: detectLanguage(incoming || "en"),
      confidence: 0.7,
      reason: skip.reason,
      recommended_action: "skip",
      engine: "local-heuristic",
    };
  }
  if (!openai?.apiKey) return heuristicReply(input);

  const transcript = input.messages
    .slice(-24)
    .map((m) => `${m.direction === "inbound" ? m.senderName || "Them" : "Me"}: ${m.body}`)
    .join("\n");
  const examples = input.styleExamples.filter(Boolean).slice(0, 8).map((e, i) => `${i + 1}. ${e}`).join("\n") || "(none provided)";
  const memory = input.memory.map((m) => `- ${m.key}: ${m.value}`).join("\n") || "(none — do not invent any)";
  const system = `You sit in the chat as a present, kind companion — not an assistant, bot, tutor, or customer-support agent.
Write 1-2 short natural chat lines in the SAME language as the latest inbound message.
Use the full visible transcript for context.
Never invent personal facts, memories, names, jobs, or that you were physically somewhere.
Never use assistant voice: no "great question", "happy to help", "as an AI", "let me know if you need", "thanks for writing", "I'll check and follow up".
If the latest inbound does not need a reply (ack, thanks, already covered, bot noise, empty fragment), set recommended_action to "skip" and reply to "".
"reason" is one short sentence for the user: why this reply (or why skip).
Output JSON only: {"reply":"...","language":"bcp47","confidence":0-1,"reason":"short","recommended_action":"draft"|"approve"|"send"|"skip"}`;
  const user = `Platform: ${input.platform}
Conversation: ${input.conversationTitle} (${input.conversationCategory})
Mode: ${input.settings.mode}; simulation: ${input.settings.simulationEnabled}

Style examples (cadence only — not biography to copy as fact):
${examples}

Notes: ${input.styleNotes || ""}

Memory (only these facts exist):
${memory}

Visible room / thread:
${transcript}`;

  const res = await fetchFn(`${openai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openai.model,
      temperature: 0.65,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const fallback = heuristicReply(input);
    fallback.reason = `${fallback.reason} (model HTTP ${res.status}; companion heuristic used)`;
    fallback.confidence = Math.min(fallback.confidence, 0.4);
    return fallback;
  }
  const json = (await res.json()) as any;
  const content = json.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(content);
  if (!parsed) {
    const fallback = heuristicReply(input);
    fallback.reason = `${fallback.reason} (model JSON missing; companion heuristic used)`;
    return fallback;
  }
  if (parsed.recommended_action === "skip" || !parsed.reply.trim()) {
    return { ...parsed, reply: "", recommended_action: "skip", engine: "openai" };
  }
  const quality = qualityCheck(parsed.reply, incoming);
  if (!quality.ok) {
    const fallback = heuristicReply(input);
    fallback.reason = quality.reason.includes("Assistant")
      ? "Model sounded like an assistant; used companion heuristic instead."
      : fallback.reason;
    return fallback;
  }
  return {
    ...parsed,
    reason: parsed.reason || whyThisReply(incoming, input.messages),
    engine: "openai",
  };
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
      reason: typeof obj.reason === "string" ? obj.reason : "Companion draft",
      recommended_action: ["draft", "approve", "send", "skip"].includes(obj.recommended_action)
        ? obj.recommended_action
        : "approve",
    };
  } catch {
    return null;
  }
}
