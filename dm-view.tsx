const BG_STYLES = `
  @keyframes cbg-scan { 0%{transform:translateY(-100%);opacity:0;} 10%{opacity:0.6;} 90%{opacity:0.4;} 100%{transform:translateY(400%);opacity:0;} }
  @keyframes cbg-pulse-slow { 0%,100%{opacity:0.12;transform:scale(1);} 50%{opacity:0.28;transform:scale(1.15);} }
  @keyframes cbg-spark-up { 0%{transform:translateY(0) scale(1);opacity:1;} 100%{transform:translateY(-200px) scale(0.2);opacity:0;} }
  @keyframes cbg-float-x { 0%{transform:translateX(0) translateY(0);} 50%{transform:translateX(18px) translateY(-12px);} 100%{transform:translateX(0) translateY(0);} }
  @keyframes cbg-wave { 0%{transform:translateX(-100%) scaleY(1);opacity:0;} 15%{opacity:0.5;} 85%{opacity:0.3;} 100%{transform:translateX(200%) scaleY(1.4);opacity:0;} }
  @keyframes cbg-twinkle { 0%,100%{opacity:0;transform:scale(0);} 50%{opacity:1;transform:scale(1);} }
  @keyframes cbg-drip { 0%{transform:translateY(-20px);opacity:0;} 10%{opacity:0.8;} 80%{opacity:0.4;} 100%{transform:translateY(280px);opacity:0;} }
  @keyframes cbg-bolt { 0%,85%,100%{opacity:0;} 86%,94%{opacity:0.7;} 95%,99%{opacity:0.2;} }
  @keyframes cbg-aurora-wave { 0%{background-position:0% 50%;} 50%{background-position:100% 50%;} 100%{background-position:0% 50%;} }
  @keyframes cbg-bubble { 0%{transform:translateY(0) scale(0.6);opacity:0;} 10%{opacity:0.7;} 80%{opacity:0.3;} 100%{transform:translateY(-220px) scale(1.2);opacity:0;} }
  @keyframes cbg-fall { 0%{transform:translateY(-20px) rotate(0deg);opacity:0;} 10%{opacity:0.7;} 85%{opacity:0.5;} 100%{transform:translateY(300px) rotate(360deg);opacity:0;} }
  @keyframes cbg-shimmer { 0%,100%{opacity:0.06;} 50%{opacity:0.18;} }
`;

function styleTag() {
  return <style>{BG_STYLES}</style>;
}

function ScanLineBg({ color }: { color: string }) {
  const lines = Array.from({ length: 5 });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {lines.map((_, i) => (
        <div key={i} style={{
          position: "absolute", left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          top: 0,
          animation: `cbg-scan ${3 + i * 0.8}s linear infinite`,
          animationDelay: `${i * (3 / lines.length)}s`,
        }} />
      ))}
    </div>
  );
}

function SparkBg({ color1, color2 }: { color1: string; color2: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: 2 + (i % 3),
          height: 10 + (i % 5) * 7,
          borderRadius: 4,
          background: i % 2 === 0
            ? `linear-gradient(to top, ${color1}, ${color2})`
            : `linear-gradient(to top, ${color2}, transparent)`,
          left: `${(i * 13 + 8) % 90}%`,
          bottom: `${(i % 3) * 5}%`,
          opacity: 0,
          animation: `cbg-spark-up ${1.2 + (i % 5) * 0.35}s ease-out infinite`,
          animationDelay: `${(i % 7) * 0.22}s`,
        }} />
      ))}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "30%",
        background: `linear-gradient(to top, ${color1}22, transparent)`,
      }} />
    </div>
  );
}

function TwinkleBg({ color }: { color: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: 2 + (i % 3),
          height: 2 + (i % 3),
          borderRadius: "50%",
          background: color,
          left: `${(i * 17 + 3) % 92}%`,
          top: `${(i * 23 + 5) % 90}%`,
          boxShadow: `0 0 ${4 + (i % 3) * 2}px ${color}`,
          animation: `cbg-twinkle ${1.2 + (i % 5) * 0.35}s ease-in-out infinite`,
          animationDelay: `${(i % 7) * 0.25}s`,
        }} />
      ))}
    </div>
  );
}

function FallBg({ emoji, count = 10 }: { emoji: string; count?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          fontSize: 10 + (i % 4) * 5,
          left: `${(i * 13 + 5) % 88}%`,
          top: "-10%",
          animation: `cbg-fall ${2 + (i % 5) * 0.4}s linear infinite`,
          animationDelay: `${(i % 7) * 0.4}s`,
          lineHeight: 1,
          opacity: 0,
        }}>{emoji}</div>
      ))}
    </div>
  );
}

function BubbleBg({ color }: { color: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: 5 + (i % 3) * 4,
          height: 5 + (i % 3) * 4,
          borderRadius: "50%",
          border: `1.5px solid ${color}`,
          background: `${color}22`,
          left: `${(i * 11 + 4) % 88}%`,
          bottom: `${(i % 4) * 8}%`,
          animation: `cbg-bubble ${1.8 + (i % 5) * 0.4}s ease-out infinite`,
          animationDelay: `${(i % 7) * 0.3}s`,
        }} />
      ))}
    </div>
  );
}

function PulseBg({ colors }: { colors: string[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {colors.map((c, i) => (
        <div key={i} style={{
          position: "absolute",
          borderRadius: "50%",
          width: 150 + i * 50, height: 150 + i * 50,
          left: `${10 + i * 20}%`, top: `${5 + i * 15}%`,
          background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
          animation: `cbg-pulse-slow ${2.5 + i * 0.8}s ease-in-out infinite`,
          animationDelay: `${i * 0.9}s`,
        }} />
      ))}
    </div>
  );
}

function LightningBg() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {Array.from({ length: 4 }).map((_, i) => (
        <svg key={i} style={{
          position: "absolute",
          left: `${(i * 28 + 5) % 75}%`,
          top: `${(i * 22 + 5) % 60}%`,
          width: 40, height: 70,
          opacity: 0,
          animation: `cbg-bolt ${2 + i * 0.7}s ease-in-out infinite`,
          animationDelay: `${i * 0.5}s`,
        }} viewBox="0 0 40 70" fill="none">
          <polyline points="22,2 12,36 22,36 16,68 30,25 20,25 28,2" stroke="#ffd700" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <polyline points="22,2 12,36 22,36 16,68 30,25 20,25 28,2" stroke="white" strokeWidth="1" fill="none" opacity="0.6" />
        </svg>
      ))}
    </div>
  );
}

function AuroraBg() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {styleTag()}
      {[
        { colors: "#00ff88, #ff00aa", delay: 0, top: "10%" },
        { colors: "#ff00aa, #0088ff", delay: 1.5, top: "30%" },
        { colors: "#0088ff, #00ff88", delay: 3, top: "55%" },
      ].map((band, i) => (
        <div key={i} style={{
          position: "absolute",
          left: 0, right: 0,
          height: 40,
          top: band.top,
          background: `linear-gradient(90deg, transparent, ${band.colors}, transparent)`,
          backgroundSize: "300% 100%",
          opacity: 0.18,
          animation: `cbg-aurora-wave ${5 + i}s ease-in-out infinite`,
          animationDelay: `${band.delay}s`,
          filter: "blur(8px)",
        }} />
      ))}
    </div>
  );
}

function GlowBg({ color }: { color: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${color} 0%, transparent 70%)`,
        animation: "cbg-pulse-slow 3.5s ease-in-out infinite",
      }} />
    </div>
  );
}

type BgFC = React.FC;

const BG_MAP: Record<string, BgFC> = {
  "404notfound":  () => <ScanLineBg color="rgba(0,255,65,0.5)" />,
  cherry:         () => <FallBg emoji="🌸" count={12} />,
  fireworks:      () => <TwinkleBg color="#ffcc00" />,
  wings:          () => <GlowBg color="rgba(220,220,255,0.1)" />,
  flames:         () => <SparkBg color1="#ff4400" color2="#ff8800" />,
  stars_deco:     () => <FallBg emoji="⭐" count={10} />,
  snowflakes:     () => <FallBg emoji="❄️" count={10} />,
  hearts_deco:    () => <FallBg emoji="❤️" count={10} />,
  lightning_d:    LightningBg,
  bubbles_d:      () => <BubbleBg color="#66aaff" />,
  rainbow_d:      AuroraBg,
  galaxy_d:       () => <TwinkleBg color="#aa44ff" />,
  clover:         () => <FallBg emoji="🍀" count={10} />,
  confetti:       () => <FallBg emoji="🎊" count={12} />,
  crown_deco:     () => <GlowBg color="rgba(255,215,0,0.12)" />,
  flower_deco:    () => <FallBg emoji="🌺" count={10} />,
  ghost:          () => <FallBg emoji="👻" count={7} />,
  leaves:         () => <FallBg emoji="🍂" count={12} />,
  moon:           () => <TwinkleBg color="#ddddff" />,
  music:          () => <FallBg emoji="🎵" count={8} />,
  planet:         () => <PulseBg colors={["rgba(68,136,255,0.1)", "rgba(34,102,204,0.08)"]} />,
  pumpkin:        () => <GlowBg color="rgba(255,102,0,0.12)" />,
  rose:           () => <FallBg emoji="🌹" count={9} />,
  witch:          () => <PulseBg colors={["rgba(136,34,153,0.1)", "rgba(68,0,102,0.08)"]} />,
  xmas:           () => <FallBg emoji="⛄" count={8} />,
};

interface CardBgEffectProps {
  decorationId?: string | null;
}

export function CardBgEffect({ decorationId }: CardBgEffectProps) {
  if (!decorationId || decorationId === "none") return null;
  const Bg = BG_MAP[decorationId];
  if (!Bg) return null;
  return <Bg />;
}
