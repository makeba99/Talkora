import type { ChatSummary } from "../core/types.js";

export interface ProbeInterpretation {
  supported: boolean;
  teamsWindowFound: boolean;
  confidence: "none" | "low" | "high";
  followChatId: string | null;
  suggestedChatId: string | null;
  suggestedLabel: string | null;
  messageTextExposed: boolean;
  composerFound: boolean;
  canSendThroughUi: false;
  notes: string[];
}

export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+\|\s+microsoft teams.*/i, "")
    .replace(/^microsoft teams\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function interpretProbe(
  input: {
    supported: boolean;
    teamsWindowFound: boolean;
    windowTitle: string | null;
    selectedLabels: string[];
    messageTextExposed: boolean;
    composerFound: boolean;
    notes: string[];
  },
  chats: ChatSummary[],
): ProbeInterpretation {
  const base: ProbeInterpretation = {
    supported: input.supported,
    teamsWindowFound: input.teamsWindowFound,
    confidence: "none",
    followChatId: null,
    suggestedChatId: null,
    suggestedLabel: null,
    messageTextExposed: input.messageTextExposed,
    composerFound: input.composerFound,
    canSendThroughUi: false,
    notes: [...input.notes],
  };
  if (!input.supported) {
    base.notes.push("UI Automation is only available on Windows.");
    return base;
  }
  const selected = uniqueMatch(input.selectedLabels, chats);
  if (selected.kind === "one") {
    base.confidence = "high";
    base.followChatId = selected.chat.id;
    base.suggestedChatId = selected.chat.id;
    base.suggestedLabel = selected.chat.label;
    base.notes.push("A selected Teams item matched one chat. Raw on-screen text was not stored.");
    return base;
  }
  if (selected.kind === "many") {
    base.notes.push("More than one chat matched the selected Teams item, so the monitored chat was left unchanged.");
    return base;
  }
  const title = input.windowTitle ? uniqueMatch([input.windowTitle], chats) : { kind: "none" as const };
  if (title.kind === "one") {
    base.confidence = "low";
    base.suggestedChatId = title.chat.id;
    base.suggestedLabel = title.chat.label;
    base.notes.push("The window title matches one chat, but that is only a hint. It does not change the monitored chat by itself.");
    return base;
  }
  if (!input.teamsWindowFound) base.notes.push("No Teams window was found.");
  else base.notes.push("The Teams window did not expose a selected chat that matches one Graph chat.");
  return base;
}

function uniqueMatch(labels: string[], chats: ChatSummary[]): { kind: "none" } | { kind: "many" } | { kind: "one"; chat: ChatSummary } {
  const wanted = new Set(labels.map(normalizeLabel).filter(Boolean));
  if (!wanted.size) return { kind: "none" };
  const hits = chats.filter((chat) => {
    const label = normalizeLabel(chat.label);
    if (!label) return false;
    for (const candidate of wanted) {
      if (candidate === label || candidate.startsWith(`${label} `) || candidate.startsWith(`${label}:`)) return true;
    }
    return false;
  });
  if (hits.length === 1) return { kind: "one", chat: hits[0] };
  if (hits.length > 1) return { kind: "many" };
  return { kind: "none" };
}
