import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface BadgeDef {
  id: string;
  label: string;
  emoji: string;
  color: string;
  quote: string;
}

interface BadgeAwardedEvent {
  badge: { id: string; userId: string; badgeType: string; createdAt: string };
  badgeDef: BadgeDef;
  userName: string;
  userAvatar?: string | null;
  userId: string;
  quote: string;
  badgeGifUrl?: string | null;
}

interface BadgeAnnouncementProps {
  event: BadgeAwardedEvent | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4200;

function playCelebrationSound(muted: boolean) {
  if (muted) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (freq: number, start: number, dur: number, gain: number, type: OscillatorType = "sine") => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.01, ctx.currentTime + start + dur);
      g.gain.setValueAtTime(0, ctx.currentTime + start);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };

    const fanfare = [
      [523.25, 0.0, 0.18, 0.28],
      [659.25, 0.18, 0.18, 0.28],
      [783.99, 0.36, 0.18, 0.28],
      [1046.5, 0.54, 0.36, 0.35],
      [783.99, 0.54, 0.36, 0.22],
      [1046.5, 0.9, 0.5, 0.38],
    ] as [number, number, number, number][];

    fanfare.forEach(([f, s, d, g]) => playTone(f, s, d, g, "triangle"));

    const applauseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2.5, ctx.sampleRate);
    const channelData = applauseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      const envelope = Math.sin((i / channelData.length) * Math.PI);
      channelData[i] = (Math.random() * 2 - 1) * 0.25 * envelope;
    }
    const applauseSource = ctx.createBufferSource();
    applauseSource.buffer = applauseBuffer;
    const applauseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 3000;
    filter.Q.value = 0.4;
    applauseSource.connect(filter);
    filter.connect(applauseGain);
    applauseGain.connect(ctx.destination);
    applauseGain.gain.setValueAtTime(0, ctx.currentTime + 0.5);
    applauseGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.1);
    applauseGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2.8);
    applauseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.2);
    applauseSource.start(ctx.currentTime + 0.5);
    applauseSource.stop(ctx.currentTime + 3.3);

    setTimeout(() => ctx.close(), 4000);
  } catch (_) {}
}

function ConfettiCanvas({ active, color }: { active: boolean; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Defer the offsetWidth/offsetHeight read to the next rAF so we never
    // force a synchronous layout recalculation (Lighthouse "forced reflow").
    let setupRaf: number;
    setupRaf = requestAnimationFrame(() => {
      const W = (canvas.width = canvas.offsetWidth);
      const H = (canvas.height = canvas.offsetHeight);

      const palette = [color, "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"];

      type Piece = {
        x: number; y: number; vx: number; vy: number;
        rot: number; vrot: number; size: number;
        color: string; shape: "rect" | "circle" | "star";
        opacity: number; decay: number;
      };

      const pieces: Piece[] = [];
      const BURST_COUNT = 120;

      for (let i = 0; i < BURST_COUNT; i++) {
        const angle = (Math.random() * Math.PI * 2);
        const speed = 3 + Math.random() * 8;
        pieces.push({
          x: W / 2 + (Math.random() - 0.5) * 40,
          y: H * 0.38,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4 - Math.random() * 4,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.25,
          size: 5 + Math.random() * 9,
          color: palette[Math.floor(Math.random() * palette.length)],
          shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
          opacity: 1,
          decay: 0.008 + Math.random() * 0.006,
        });
      }

      const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const b = a + Math.PI / 5;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          ctx.lineTo(x + Math.cos(b) * (r * 0.4), y + Math.sin(b) * (r * 0.4));
        }
        ctx.closePath();
        ctx.fill();
      };

      const animate = () => {
        ctx.clearRect(0, 0, W, H);
        let alive = false;
        for (const p of pieces) {
          if (p.opacity <= 0) continue;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.22;
          p.vx *= 0.99;
          p.rot += p.vrot;
          p.opacity -= p.decay;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          if (p.shape === "rect") {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else if (p.shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            drawStar(ctx, 0, 0, p.size / 2);
          }
          ctx.restore();
        }
        if (alive) rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    });
    return () => {
      cancelAnimationFrame(setupRaf);
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, color]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

const SPARKLE_COUNT = 8;

function SparkleRing({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
      {Array.from({ length: SPARKLE_COUNT }).map((_, i) => {
        const angle = (i / SPARKLE_COUNT) * 360;
        const delay = (i / SPARKLE_COUNT) * 1.2;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 6px 2px ${color}80`,
              marginLeft: -3,
              marginTop: -3,
            }}
            animate={{
              x: [0, Math.cos((angle * Math.PI) / 180) * 26],
              y: [0, Math.sin((angle * Math.PI) / 180) * 26],
              opacity: [0, 1, 0],
              scale: [0, 1.4, 0],
            }}
            transition={{
              duration: 1.8,
              delay,
              repeat: Infinity,
              repeatDelay: 0.6,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}

export function BadgeAnnouncement({ event, onDismiss }: BadgeAnnouncementProps) {
  const { user } = useAuth();
  const [muted, setMuted] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const hasPlayedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard incomplete payloads — a missing badgeDef previously crashed the
  // error boundary with "Something went wrong" right after a successful award.
  const safeEvent = event && event.badge?.id && event.badgeDef?.label
    ? {
        ...event,
        badgeDef: {
          id: event.badgeDef.id || event.badge.badgeType || "badge",
          label: event.badgeDef.label,
          emoji: event.badgeDef.emoji || "🏅",
          color: event.badgeDef.color || "#8B5CF6",
          quote: event.badgeDef.quote || event.quote || "",
        },
        userName: event.userName || "A user",
        quote: event.quote || event.badgeDef.quote || "",
      }
    : null;

  const isForCurrentUser = user && safeEvent && user.id === safeEvent.userId;

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfettiActive(false);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!safeEvent) {
      setConfettiActive(false);
      hasPlayedRef.current = null;
      return;
    }

    const eventKey = safeEvent.badge.id;
    if (hasPlayedRef.current !== eventKey) {
      hasPlayedRef.current = eventKey;
      setConfettiActive(true);
      playCelebrationSound(muted);
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // Depend on stable badge id — not the whole safeEvent object (new every render).
  }, [safeEvent?.badge.id, handleDismiss, muted]);

  const initials = safeEvent?.userName
    ? safeEvent.userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const color = safeEvent?.badgeDef.color ?? "#8B5CF6";

  return (
    <AnimatePresence>
      {safeEvent && (
        <motion.div
          key={safeEvent.badge.id}
          initial={{ opacity: 0, y: -24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[min(420px,calc(100vw-24px))] pointer-events-auto"
          data-testid="badge-announcement"
        >
          <div
            className="relative overflow-hidden rounded-2xl border shadow-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(22,18,40,0.96), rgba(10,8,22,0.98))",
              borderColor: `${color}55`,
              boxShadow: `0 0 0 1px ${color}28, 0 16px 40px rgba(0,0,0,0.55), 0 0 28px ${color}30`,
            }}
          >
            <ConfettiCanvas active={confettiActive} color={color} />
            <div className="relative flex items-center gap-3 px-3.5 py-2.5" style={{ zIndex: 3 }}>
              <motion.div
                className="relative flex-shrink-0"
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
              >
                <div className="relative w-11 h-11">
                  <SparkleRing color={color} />
                  <Avatar
                    className="w-11 h-11 ring-2 relative"
                    style={{ ringColor: color } as any}
                    data-testid="badge-user-avatar"
                  >
                    <AvatarImage src={safeEvent.userAvatar ?? undefined} alt="" />
                    <AvatarFallback className="text-sm font-bold" style={{ background: `${color}25`, color }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] z-10"
                    style={{ background: `${color}28`, border: `1px solid ${color}70` }}
                  >
                    {safeEvent.badgeDef.emoji}
                  </span>
                </div>
              </motion.div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color }}>
                  Nomination{isForCurrentUser ? " · for you" : ""}
                </p>
                <p className="text-white font-semibold text-[13px] leading-tight truncate" data-testid="badge-user-name">
                  {safeEvent.userName}
                </p>
                <p className="text-white/70 text-[12px] truncate" data-testid="badge-label">
                  {safeEvent.badgeDef.emoji} {safeEvent.badgeDef.label}
                </p>
              </div>

              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => {
                    setMuted((m) => !m);
                    if (muted) playCelebrationSound(false);
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10"
                  data-testid="button-toggle-mute"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10"
                  data-testid="button-dismiss-badge"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <motion.div
              className="absolute bottom-0 left-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, ${color}, ${color}70)` }}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
