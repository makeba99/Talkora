import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dices, ChevronLeft, Play, Pause, RotateCcw, Plus, Minus,
  Trophy, Users, Brain, Zap, Timer, Info, Crown, Star,
  MessageSquare, Eye, Pencil, Laugh, Scale, Ear,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ─── Game Definitions ────────────────────────────────────────────────────────
type GameTag = "Word" | "Strategy" | "Bluffing" | "Improv" | "Logic" | "Drawing" | "Negotiation";

interface GameDef {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  tag: GameTag;
  tagColor: string;
  tagBg: string;
  coreMechanic: string;
  intellectualElement: string;
  rules: string[];
  whyItWorks: string;
  minPlayers: number;
  maxPlayers: number;
  hasTimer: boolean;
  defaultTimerSeconds: number;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
}

const GAMES: GameDef[] = [
  {
    id: "chain-reaction",
    name: "Chain Reaction",
    emoji: "⛓️",
    tagline: "Connect words in non-obvious ways — explain in 5 seconds or lose a life",
    tag: "Word",
    tagColor: "rgb(129,140,248)",
    tagBg: "rgba(129,140,248,0.15)",
    coreMechanic: "Players stand in a circle. One player says a word. The next must say a word that connects to it in a non-obvious way — and must explain the connection aloud within 5 seconds.",
    intellectualElement: "Lateral thinking, associative reasoning, and vocabulary under timed pressure.",
    rules: [
      "Say a word. The next player says a new word that connects to it — non-obvious links score higher.",
      'You must explain the connection in 5 seconds (e.g. "Cloud → Sheep: both are fluffy and drift").',
      "If you repeat a connection type already used this round, you lose a life.",
      "Each player starts with 3 lives. Last player with lives remaining wins.",
    ],
    whyItWorks: "The meta-rule about repeating connection types forces increasing creativity as the game progresses. Early rounds are breezy — late rounds require genuinely novel thinking.",
    minPlayers: 4,
    maxPlayers: 20,
    hasTimer: true,
    defaultTimerSeconds: 5,
    icon: Zap,
    accentColor: "rgb(129,140,248)",
    accentBg: "rgba(129,140,248,0.12)",
  },
  {
    id: "silent-architect",
    name: "Silent Architect",
    emoji: "🤫",
    tagline: "Guide your team with only gestures while rivals try to confuse them",
    tag: "Strategy",
    tagColor: "rgb(52,211,153)",
    tagBg: "rgba(52,211,153,0.15)",
    coreMechanic: "One player (the Architect) guides their team to describe a scenario using only hand gestures — no words, no sounds. Other teams can see the target prompt and interject gestures to confuse the builders.",
    intellectualElement: "Spatial reasoning, non-verbal communication strategy, and reading deception in real time.",
    rules: [
      "The Architect draws a scenario card and has 90 seconds to silently communicate it.",
      "Builders can only act on gestures — no questions allowed.",
      "Saboteurs from opposing teams interject their own gestures to mislead.",
      "A judge scores accuracy of the team's final interpretation.",
    ],
    whyItWorks: "The sabotage layer creates hilarious misdirection and forces Architects to develop increasingly creative private gesture languages each round.",
    minPlayers: 6,
    maxPlayers: 20,
    hasTimer: true,
    defaultTimerSeconds: 90,
    icon: Eye,
    accentColor: "rgb(52,211,153)",
    accentBg: "rgba(52,211,153,0.12)",
  },
  {
    id: "honest-liar",
    name: "The Honest Liar",
    emoji: "🎭",
    tagline: "Two truths, one lie — earn points for both fooling AND spotting lies",
    tag: "Bluffing",
    tagColor: "rgb(251,146,60)",
    tagBg: "rgba(251,146,60,0.15)",
    coreMechanic: "Each player gets 3 fact cards about themselves — 2 true, 1 false. They read all three confidently. The group votes on which is false. Players earn points both for fooling others AND for correctly identifying lies.",
    intellectualElement: "Psychological reading, strategic bluffing, and truth calibration.",
    rules: [
      "Prepare 3 facts about yourself — 2 true, 1 false. Read all three in the same tone.",
      "The group votes on which fact is false. Then reveal the truth.",
      "Earn 2 points for each person you fooled, 1 point for each lie you correctly spotted.",
      "Most points after everyone has presented wins.",
    ],
    whyItWorks: "The dual scoring system means you're engaged every single round — whether presenting or guessing. Unlike standard Two Truths and a Lie, no one checks out.",
    minPlayers: 4,
    maxPlayers: 20,
    hasTimer: false,
    defaultTimerSeconds: 60,
    icon: Laugh,
    accentColor: "rgb(251,146,60)",
    accentBg: "rgba(251,146,60,0.12)",
  },
  {
    id: "word-siege",
    name: "Word Siege",
    emoji: "⚔️",
    tagline: "Pull a shared token toward your team using cleverer word associations",
    tag: "Word",
    tagColor: "rgb(129,140,248)",
    tagBg: "rgba(129,140,248,0.15)",
    coreMechanic: "Two teams. A neutral \"Fortress Word\" is chosen. Teams alternate giving one-word clues that move a shared token toward their side of a semantic spectrum — judged by a rotating neutral player.",
    intellectualElement: "Semantic awareness, competitive vocabulary, and judging nuance in language.",
    rules: [
      "Choose a Fortress Word (e.g., OCEAN). Place the token in the middle of a 1–10 spectrum.",
      "Both teams simultaneously write a one-word clue, then reveal.",
      "The neutral judge moves the token one step toward whichever clue is semantically closer to the Fortress Word.",
      "First team to pull the token fully to their side wins the round.",
    ],
    whyItWorks: "Disagreements over the judge's call spark genuine debates about language nuance. Every Fortress Word creates a completely different game.",
    minPlayers: 4,
    maxPlayers: 16,
    hasTimer: true,
    defaultTimerSeconds: 30,
    icon: Scale,
    accentColor: "rgb(250,204,21)",
    accentBg: "rgba(250,204,21,0.10)",
  },
  {
    id: "freeze-frame",
    name: "Freeze Frame",
    emoji: "🎬",
    tagline: "Narrate a story live — then twist it around whatever poses your players froze in",
    tag: "Improv",
    tagColor: "rgb(167,139,250)",
    tagBg: "rgba(167,139,250,0.15)",
    coreMechanic: "One player narrates a dramatic scenario in real time while others physically act it out. At any moment, the narrator shouts \"Freeze!\" — then narrates a plot twist that logically connects to whatever frozen tableau has formed.",
    intellectualElement: "Improvisational storytelling and creative constraint — the narrator can't control the tableau, only react to it.",
    rules: [
      "The narrator describes an unfolding scene while actors physically embody it.",
      'At any moment, shout "Freeze!" — actors must hold their exact position for 10 seconds.',
      "The narrator invents a plot twist that logically connects to the frozen scene.",
      "Group votes: valid twist = 1 point. Narrators rotate every 2 minutes.",
    ],
    whyItWorks: "The narrator has zero control over the frozen tableau, making every story genuinely reactive and collaborative. The reveals are always surprising.",
    minPlayers: 5,
    maxPlayers: 20,
    hasTimer: true,
    defaultTimerSeconds: 120,
    icon: Pencil,
    accentColor: "rgb(167,139,250)",
    accentBg: "rgba(167,139,250,0.12)",
  },
  {
    id: "consensus-engine",
    name: "Consensus Engine",
    emoji: "🧩",
    tagline: "Rank 7 absurd items together — with zero talking, only eye contact",
    tag: "Negotiation",
    tagColor: "rgb(34,211,238)",
    tagBg: "rgba(34,211,238,0.15)",
    coreMechanic: "The group receives an absurd ranking task. Everyone writes their individual ranked list silently. Then, without talking, the group must arrange shared cards into one agreed ranking using only eye contact and pointing.",
    intellectualElement: "Non-verbal negotiation, strategic signaling, and emergent group dynamics.",
    rules: [
      "Individually and silently, rank 7 items on a prompt card (e.g., \"Most useful on the moon\").",
      "No speaking, mouthing, or writing during the group phase — only pointing and eye contact.",
      "3 minutes to reach a group consensus arrangement.",
      "Score = how closely the final group ranking matches the mathematical average of all individual lists.",
    ],
    whyItWorks: "The no-talking rule reveals dominant personalities, quiet strategists, and real group dynamics in ways verbal discussion never does. Wildly replayable with new prompts.",
    minPlayers: 4,
    maxPlayers: 12,
    hasTimer: true,
    defaultTimerSeconds: 180,
    icon: Brain,
    accentColor: "rgb(34,211,238)",
    accentBg: "rgba(34,211,238,0.10)",
  },
  {
    id: "echo-chamber",
    name: "Echo Chamber",
    emoji: "📞",
    tagline: "Telephone meets Pictionary — trace how meaning transforms step by step",
    tag: "Drawing",
    tagColor: "rgb(248,113,113)",
    tagBg: "rgba(248,113,113,0.15)",
    coreMechanic: "One player whispers a complex sentence to the next. But every player along the chain must also draw what they heard before passing it on. The final player must reconstruct the original sentence from the last drawing only.",
    intellectualElement: "Translation between verbal and visual thinking, inference, and pattern recognition.",
    rules: [
      "Player 1 whispers a complex sentence to Player 2, who has 20 seconds to draw it.",
      "Player 2 whispers their interpretation to Player 3 (based on their drawing), who draws again.",
      "No letters, numbers, or symbols allowed in drawings.",
      "Final player reconstructs the sentence. Points per correct word recovered. The link that broke the chain most loses a point.",
    ],
    whyItWorks: "The accountability layer — tracking which drawing broke the chain — makes everyone draw thoughtfully. The step-by-step reveal sequence is always the funniest part.",
    minPlayers: 5,
    maxPlayers: 15,
    hasTimer: true,
    defaultTimerSeconds: 20,
    icon: Ear,
    accentColor: "rgb(248,113,113)",
    accentBg: "rgba(248,113,113,0.12)",
  },
];

// ─── Tag colours ─────────────────────────────────────────────────────────────
const TAG_STYLES: Record<GameTag, { color: string; bg: string }> = {
  Word:        { color: "rgb(129,140,248)", bg: "rgba(129,140,248,0.18)" },
  Strategy:    { color: "rgb(52,211,153)",  bg: "rgba(52,211,153,0.18)"  },
  Bluffing:    { color: "rgb(251,146,60)",  bg: "rgba(251,146,60,0.18)"  },
  Improv:      { color: "rgb(167,139,250)", bg: "rgba(167,139,250,0.18)" },
  Logic:       { color: "rgb(34,211,238)",  bg: "rgba(34,211,238,0.18)"  },
  Drawing:     { color: "rgb(248,113,113)", bg: "rgba(248,113,113,0.18)" },
  Negotiation: { color: "rgb(34,211,238)",  bg: "rgba(34,211,238,0.18)"  },
};

// ─── Props ────────────────────────────────────────────────────────────────────
export interface GroupGameParticipant {
  id: string;
  displayName?: string | null;
  firstName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
}

interface GroupGamesPanelProps {
  participants: GroupGameParticipant[];
  userId: string;
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useTimer(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback((s?: number) => {
    setRunning(false);
    setSeconds(s ?? initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) { setRunning(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  return { seconds, running, start, pause, reset };
}

// ─── Score tracker ────────────────────────────────────────────────────────────
function ScoreTracker({ participants }: { participants: GroupGameParticipant[] }) {
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(participants.map(p => [p.id, 0]))
  );
  const [lives, setLives] = useState<Record<string, number>>(() =>
    Object.fromEntries(participants.map(p => [p.id, 3]))
  );
  const [mode, setMode] = useState<"score" | "lives">("score");

  const getName = (p: GroupGameParticipant) =>
    p.displayName || p.firstName || p.email?.split("@")[0] || "Player";

  const adjust = (id: string, delta: number) => {
    if (mode === "score") {
      setScores(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
    } else {
      setLives(prev => ({ ...prev, [id]: Math.max(0, Math.min(5, (prev[id] ?? 3) + delta)) }));
    }
  };

  const reset = () => {
    setScores(Object.fromEntries(participants.map(p => [p.id, 0])));
    setLives(Object.fromEntries(participants.map(p => [p.id, 3])));
  };

  // sort by current metric descending
  const sorted = [...participants].sort((a, b) =>
    mode === "score"
      ? (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
      : (lives[b.id] ?? 3) - (lives[a.id] ?? 3)
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Mode toggle + reset */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-white/10 text-[10px] font-semibold">
          <button
            onClick={() => setMode("score")}
            className="px-2 py-1 transition-colors"
            style={mode === "score" ? { background: "rgba(250,204,21,0.2)", color: "rgb(250,204,21)" } : { color: "rgba(255,255,255,0.4)" }}
          >
            <Trophy className="w-3 h-3 inline mr-1" />Score
          </button>
          <button
            onClick={() => setMode("lives")}
            className="px-2 py-1 transition-colors"
            style={mode === "lives" ? { background: "rgba(248,113,113,0.2)", color: "rgb(248,113,113)" } : { color: "rgba(255,255,255,0.4)" }}
          >
            ❤️ Lives
          </button>
        </div>
        <button
          onClick={reset}
          className="ml-auto text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-2.5 h-2.5" /> Reset
        </button>
      </div>

      {/* Player rows */}
      <div className="flex flex-col gap-1">
        {sorted.map((p, i) => {
          const val = mode === "score" ? (scores[p.id] ?? 0) : (lives[p.id] ?? 3);
          const isLeader = i === 0 && val > 0;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ background: isLeader ? "rgba(250,204,21,0.07)" : "rgba(255,255,255,0.04)" }}
            >
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarImage src={p.profileImageUrl ?? undefined} />
                <AvatarFallback className="text-[9px] font-bold">
                  {getName(p).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-[11px] font-medium text-white/80 truncate">
                {isLeader && <Crown className="w-2.5 h-2.5 inline mr-0.5 text-amber-400" />}
                {getName(p)}
              </span>
              {mode === "lives" && (
                <span className="text-[11px] mr-1">
                  {"❤️".repeat(val)}{"🖤".repeat(Math.max(0, 3 - val))}
                </span>
              )}
              <span
                className="text-[13px] font-bold tabular-nums w-7 text-center"
                style={{ color: isLeader ? "rgb(250,204,21)" : "rgba(255,255,255,0.7)" }}
              >
                {val}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => adjust(p.id, -1)}
                  className="w-5 h-5 rounded flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => adjust(p.id, 1)}
                  className="w-5 h-5 rounded flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Game Detail View ────────────────────────────────────────────────────────
function GameDetail({
  game,
  participants,
  onBack,
}: {
  game: GameDef;
  participants: GroupGameParticipant[];
  onBack: () => void;
}) {
  const timer = useTimer(game.defaultTimerSeconds);
  const [customTime, setCustomTime] = useState(game.defaultTimerSeconds);
  const [activeSection, setActiveSection] = useState<"rules" | "scores">("rules");

  const pct = customTime > 0 ? (timer.seconds / customTime) * 100 : 0;
  const mins = Math.floor(timer.seconds / 60);
  const secs = timer.seconds % 60;
  const timerColor =
    pct > 50 ? game.accentColor :
    pct > 25 ? "rgb(251,146,60)" :
    "rgb(248,113,113)";

  const Icon = game.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 px-3 pt-3 pb-2"
        style={{ borderBottom: `1px solid ${game.accentColor}25` }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors mb-2"
        >
          <ChevronLeft className="w-3 h-3" /> All Games
        </button>
        <div className="flex items-start gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: game.accentBg }}
          >
            {game.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white leading-tight">{game.name}</h3>
            <p className="text-[10px] text-white/50 mt-0.5 leading-snug">{game.tagline}</p>
          </div>
        </div>

        {/* Players + tag badges */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: game.accentBg, color: game.accentColor }}
          >
            {game.tag}
          </span>
          <span className="text-[9px] text-white/40 flex items-center gap-0.5">
            <Users className="w-2.5 h-2.5" />
            {game.minPlayers}–{game.maxPlayers} players
          </span>
        </div>
      </div>

      {/* Section toggle */}
      <div className="flex-shrink-0 flex border-b border-white/8">
        <button
          onClick={() => setActiveSection("rules")}
          className="flex-1 py-1.5 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
          style={activeSection === "rules"
            ? { color: game.accentColor, borderBottom: `2px solid ${game.accentColor}` }
            : { color: "rgba(255,255,255,0.35)" }}
        >
          <Info className="w-3 h-3" /> How to Play
        </button>
        <button
          onClick={() => setActiveSection("scores")}
          className="flex-1 py-1.5 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
          style={activeSection === "scores"
            ? { color: game.accentColor, borderBottom: `2px solid ${game.accentColor}` }
            : { color: "rgba(255,255,255,0.35)" }}
        >
          <Trophy className="w-3 h-3" /> Scoreboard
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-3" style={{ scrollbarWidth: "thin" }}>
        {activeSection === "rules" ? (
          <>
            {/* Timer */}
            {game.hasTimer && (
              <div
                className="rounded-xl p-3 flex flex-col gap-2"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${game.accentColor}20` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-white/50 flex items-center gap-1">
                    <Timer className="w-3 h-3" /> Round Timer
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setCustomTime(t => Math.max(5, t - 5)); timer.reset(Math.max(5, customTime - 5)); }}
                      className="w-5 h-5 rounded text-white/40 hover:text-white/80 flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => { setCustomTime(t => t + 5); timer.reset(customTime + 5); }}
                      className="w-5 h-5 rounded text-white/40 hover:text-white/80 flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                {/* Arc / number */}
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 flex-shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                      <circle
                        cx="28" cy="28" r="22" fill="none"
                        stroke={timerColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 22}`}
                        strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
                        style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.4s" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: timerColor }}>
                        {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : secs}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => timer.running ? timer.pause() : timer.start()}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                      style={{ background: game.accentBg, color: game.accentColor }}
                    >
                      {timer.running
                        ? <><Pause className="w-2.5 h-2.5" /> Pause</>
                        : <><Play  className="w-2.5 h-2.5" /> {timer.seconds === customTime ? "Start" : "Resume"}</>}
                    </button>
                    <button
                      onClick={() => timer.reset(customTime)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {timer.seconds === 0 && (
                  <div
                    className="text-center text-[11px] font-bold animate-pulse"
                    style={{ color: "rgb(248,113,113)" }}
                  >
                    ⏰ Time's up!
                  </div>
                )}
              </div>
            )}

            {/* Core mechanic */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Core Mechanic</p>
              <p className="text-[11px] text-white/70 leading-relaxed">{game.coreMechanic}</p>
            </div>

            {/* Rules */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1.5">Rules</p>
              <div className="flex flex-col gap-1.5">
                {game.rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-px"
                      style={{ background: game.accentBg, color: game.accentColor }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-[11px] text-white/65 leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Intellectual element */}
            <div
              className="rounded-xl p-2.5"
              style={{ background: "rgba(129,140,248,0.07)", border: "1px solid rgba(129,140,248,0.15)" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-400/70 mb-1 flex items-center gap-1">
                <Brain className="w-2.5 h-2.5" /> Intellectual Element
              </p>
              <p className="text-[11px] text-white/60 leading-relaxed">{game.intellectualElement}</p>
            </div>

            {/* Why it works */}
            <div
              className="rounded-xl p-2.5"
              style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.13)" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70 mb-1 flex items-center gap-1">
                <Star className="w-2.5 h-2.5" /> Why It Works
              </p>
              <p className="text-[11px] text-white/60 leading-relaxed">{game.whyItWorks}</p>
            </div>
          </>
        ) : (
          <ScoreTracker participants={participants} />
        )}
      </div>
    </div>
  );
}

// ─── Game Browser (main view) ────────────────────────────────────────────────
function GameBrowser({ onSelect }: { onSelect: (game: GameDef) => void }) {
  const [filter, setFilter] = useState<GameTag | "All">("All");
  const tags: (GameTag | "All")[] = ["All", "Word", "Strategy", "Bluffing", "Improv", "Negotiation", "Drawing"];
  const visible = filter === "All" ? GAMES : GAMES.filter(g => g.tag === filter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Dices className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-white">Group Games</h3>
          <span className="ml-auto text-[10px] text-white/30">{GAMES.length} games</span>
        </div>
        <p className="text-[10px] text-white/40 mt-0.5">Pick a game, play together in the room</p>

        {/* Tag filter */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {tags.map(t => {
            const style = t === "All"
              ? { color: "rgb(167,139,250)", bg: "rgba(167,139,250,0.18)" }
              : TAG_STYLES[t as GameTag];
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all"
                style={active
                  ? { background: style.bg, color: style.color, boxShadow: `0 0 8px ${style.color}30` }
                  : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Game cards */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2" style={{ scrollbarWidth: "thin" }}>
        {visible.map(game => {
          const Icon = game.icon;
          return (
            <button
              key={game.id}
              onClick={() => onSelect(game)}
              className="group w-full text-left rounded-xl p-3 transition-all duration-200 hover:scale-[1.01]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.08)`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = game.accentBg;
                (e.currentTarget as HTMLElement).style.borderColor = `${game.accentColor}40`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
              }}
              data-testid={`game-card-${game.id}`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: game.accentBg }}
                >
                  {game.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-bold text-white">{game.name}</span>
                    <span
                      className="text-[8px] font-bold px-1 py-0.5 rounded"
                      style={{ background: TAG_STYLES[game.tag].bg, color: TAG_STYLES[game.tag].color }}
                    >
                      {game.tag}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 mt-0.5 leading-snug line-clamp-2">{game.tagline}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] text-white/30 flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />
                      {game.minPlayers}–{game.maxPlayers}
                    </span>
                    {game.hasTimer && (
                      <span className="text-[9px] text-white/30 flex items-center gap-0.5">
                        <Timer className="w-2.5 h-2.5" />
                        {game.defaultTimerSeconds >= 60
                          ? `${game.defaultTimerSeconds / 60}m timer`
                          : `${game.defaultTimerSeconds}s timer`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function GroupGamesPanel({ participants, userId }: GroupGamesPanelProps) {
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {selectedGame ? (
        <GameDetail
          game={selectedGame}
          participants={participants}
          onBack={() => setSelectedGame(null)}
        />
      ) : (
        <GameBrowser onSelect={setSelectedGame} />
      )}
    </div>
  );
}
