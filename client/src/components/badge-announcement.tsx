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
}

interface BadgeAnnouncementProps {
  event: BadgeAwardedEvent | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 12000;

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

    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

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
    return () => cancelAnimationFrame(rafRef.current);
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
              x: [0, Math.cos((angle * Math.PI) / 180) * 52],
              y: [0, Math.sin((angle * Math.PI) / 180) * 52],
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

  const isForCurrentUser = user && event && user.id === event.userId;

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfettiActive(false);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!event) {
      setConfettiActive(false);
      hasPlayedRef.current = null;
      return;
    }

    const eventKey = event.badge.id;
    if (hasPlayedRef.current !== eventKey) {
      hasPlayedRef.current = eventKey;
      setConfettiActive(true);
      playCelebrationSound(muted);
    }

    timerRef.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [event, handleDismiss]);

  const initials = event?.userName
    ? event.userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const color = event?.badgeDef.color ?? "#8B5CF6";

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.badge.id}
          initial={{ opacity: 0, y: -100, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[min(500px,92vw)]"
          data-testid="badge-announcement"
        >
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl border"
            style={{
              background: `linear-gradient(150deg, rgba(8,4,22,0.97) 0%, rgba(18,10,40,0.98) 100%)`,
              borderColor: `${color}50`,
              boxShadow: `0 0 0 1px ${color}25, 0 0 60px ${color}35, 0 20px 60px rgba(0,0,0,0.7)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-15"
              style={{
                background: `radial-gradient(ellipse at 50% -10%, ${color} 0%, transparent 65%)`,
              }}
            />

            <ConfettiCanvas active={confettiActive} color={color} />

            <div className="relative p-6" style={{ zIndex: 3 }}>
              <div className="flex items-center justify-between mb-4">
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <div
                    className="text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full"
                    style={{
                      color: color,
                      background: `${color}18`,
                      border: `1px solid ${color}40`,
                    }}
                  >
                    🏆 Achievement Unlocked
                  </div>
                  {isForCurrentUser && (
                    <div
                      className="text-[11px] font-bold tracking-wider uppercase px-2 py-1 rounded-full"
                      style={{ color: "#FFD700", background: "#FFD70018", border: "1px solid #FFD70040" }}
                      data-testid="badge-for-you"
                    >
                      ✨ For You
                    </div>
                  )}
                </motion.div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setMuted((m) => !m);
                      if (muted) playCelebrationSound(false);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                    data-testid="button-toggle-mute"
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                    data-testid="button-dismiss-badge"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <motion.div
                  className="relative flex-shrink-0"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
                >
                  <div className="relative w-20 h-20">
                    <SparkleRing color={color} />

                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ background: `${color}30`, boxShadow: `0 0 0 3px ${color}60` }}
                      animate={{ boxShadow: [`0 0 0 3px ${color}60`, `0 0 0 8px ${color}30`, `0 0 0 3px ${color}60`] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />

                    <Avatar
                      className="w-20 h-20 ring-2 relative"
                      style={{ ringColor: color } as any}
                      data-testid="badge-user-avatar"
                    >
                      <AvatarImage src={event.userAvatar ?? undefined} alt="" />
                      <AvatarFallback
                        className="text-xl font-bold"
                        style={{ background: `${color}25`, color: color }}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <motion.div
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-lg z-10"
                      style={{
                        background: `${color}22`,
                        border: `2px solid ${color}70`,
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {event.badgeDef.emoji}
                    </motion.div>
                  </div>
                </motion.div>

                <motion.div
                  className="flex-1 min-w-0"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                >
                  <p className="text-white font-bold text-lg leading-tight break-words" data-testid="badge-user-name">
                    {event.userName}
                  </p>
                  <p className="text-white/55 text-sm mt-0.5">has been awarded</p>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 250 }}
                    className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold"
                    style={{
                      background: `${color}20`,
                      border: `1.5px solid ${color}55`,
                      color: color,
                      boxShadow: `0 0 16px ${color}25`,
                    }}
                    data-testid="badge-label"
                  >
                    <span className="text-base">{event.badgeDef.emoji}</span>
                    <span>{event.badgeDef.label}</span>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55 }}
                    className="text-white/45 text-xs leading-relaxed italic mt-2"
                    data-testid="badge-quote"
                  >
                    "{event.quote}"
                  </motion.p>
                </motion.div>
              </div>
            </div>

            <motion.div
              className="absolute bottom-0 left-0 h-[3px] rounded-full"
              style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }}
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
