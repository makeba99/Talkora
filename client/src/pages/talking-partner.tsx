import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Mic, Square, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTalkingPartner } from "@/hooks/use-talking-partner";
import { AiTutorFace } from "@/components/ai-tutor-face";
import { TALKING_PARTNERS, type TalkingPartner } from "@shared/talking-partners";
import { useDocumentMeta } from "@/hooks/use-document-meta";

const STATE_LABEL: Record<string, string> = {
  ready: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

export default function TalkingPartnerPage() {
  useDocumentMeta({
    title: "AI Talking Partner — Vextorn",
    description: "Practice English in a real-time voice conversation with Maya or Miles.",
  });
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [partnerId, setPartnerId] = useState("maya");
  const partner = useMemo(
    () => TALKING_PARTNERS.find((p) => p.id === partnerId) || TALKING_PARTNERS[0],
    [partnerId],
  );

  const { data: features } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/features/active"],
    enabled: !!user,
  });

  const talk = useTalkingPartner(partner);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">AI Talking Partner</h1>
        <p className="text-muted-foreground max-w-md">Sign in to talk with Maya or Miles.</p>
        <a
          href="/api/login"
          className="header-pro-btn inline-flex items-center h-10 px-5 rounded-full text-sm font-semibold"
        >
          Sign in
        </a>
        <button type="button" className="text-sm text-muted-foreground" onClick={() => navigate("/")}>
          Back to lobby
        </button>
      </div>
    );
  }

  if (features && features.talkingPartner === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold">AI Talking Partner</h1>
        <p className="text-muted-foreground">This feature is currently turned off.</p>
        <button type="button" className="text-sm underline" onClick={() => navigate("/")}>
          Back to lobby
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="p-2 rounded-full hover:bg-white/5"
          aria-label="Back to lobby"
          data-testid="button-talk-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold">AI Talking Partner</div>
          <div className="text-xs text-muted-foreground truncate">Speak naturally. Tap the mic to start.</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4 pb-10">
        <div className="flex gap-2">
          {TALKING_PARTNERS.map((p) => (
            <PartnerChip
              key={p.id}
              partner={p}
              active={p.id === partner.id}
              disabled={talk.state !== "ready"}
              onSelect={() => setPartnerId(p.id)}
            />
          ))}
        </div>

        <div className="w-40 h-40 sm:w-48 sm:h-48">
          <AiTutorFace
            gender={partner.gender}
            viseme={talk.state === "speaking" ? "ah" : "rest"}
            speaking={talk.state === "speaking"}
            personaName={partner.name}
          />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-semibold" data-testid="text-partner-name">
            {partner.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{partner.personality}</p>
          <p
            className="mt-3 text-sm font-medium tracking-wide"
            data-testid="text-talk-state"
            style={{ color: talk.state === "listening" ? "#22d3ee" : talk.state === "speaking" ? "#a78bfa" : undefined }}
          >
            ● {STATE_LABEL[talk.state] || "Ready"}
          </p>
        </div>

        {talk.lastUserText && talk.state !== "listening" && (
          <p className="max-w-md text-center text-sm text-muted-foreground">You: {talk.lastUserText}</p>
        )}
        {talk.conversation.filter((c) => c.role === "ai").slice(-1)[0] && talk.state !== "thinking" && (
          <p className="max-w-md text-center text-base">
            {talk.conversation.filter((c) => c.role === "ai").slice(-1)[0].text}
          </p>
        )}
        {talk.interim && <p className="text-sm text-cyan-300">{talk.interim}</p>}
        {talk.error && (
          <p className="max-w-md text-center text-sm text-red-300" data-testid="text-talk-error">
            {talk.error}
          </p>
        )}

        <button
          type="button"
          onClick={talk.toggleMic}
          data-testid="button-talk-mic"
          aria-label={talk.state === "listening" ? "Stop listening" : talk.state === "speaking" ? "Interrupt and speak" : "Start talking"}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
            talk.state === "listening"
              ? "bg-cyan-500 text-black shadow-[0_0_32px_rgba(34,211,238,0.45)]"
              : talk.state === "speaking"
                ? "bg-violet-500 text-white"
                : "bg-white/10 text-white border border-white/15"
          }`}
        >
          {talk.state === "listening" ? <Square className="w-8 h-8" /> : <Mic className="w-10 h-10" />}
        </button>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {talk.state === "speaking"
            ? "Tap to interrupt and speak"
            : talk.state === "listening"
              ? "Tap to stop. Speak, then pause — I'll reply."
              : "Tap the microphone to talk"}
        </p>
      </main>
    </div>
  );
}

function PartnerChip({
  partner,
  active,
  disabled,
  onSelect,
}: {
  partner: TalkingPartner;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`px-3 py-1.5 rounded-full text-sm border ${
        active ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-white/10 text-muted-foreground"
      }`}
      data-testid={`button-partner-${partner.id}`}
    >
      {partner.name}
    </button>
  );
}
