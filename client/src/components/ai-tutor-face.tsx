import type { Viseme } from "@/lib/ai-tutor/lipsync";
// Optimized 512px WebP versions (98% smaller than the original PNG portraits)
// keep visual fidelity at the rendered avatar size — the source 1500–2000px
// portraits are overkill for a circular ~256px avatar.
import femaleSrc from "@/assets/ai-tutor-female-v3.webp";
import maleSrc from "@/assets/ai-tutor-male-neumorphic.webp";
import evaSrc from "@/assets/eva-avatar.webp";

interface AiTutorFaceProps {
  gender: "Male" | "Female";
  viseme: Viseme;
  speaking: boolean;
  // The actual persona name lets us pick the right portrait when two personas
  // share the same gender (Afi K and Eva are both "Female" but must look
  // visibly different so users can tell which voice they picked).
  personaName?: string;
}

// Map a viseme to an amplitude estimate in [0..1]. The Eva TTS engine and the
// browser TTS both feed viseme updates ~14fps based on RMS, so this is a good
// proxy for "how loud is the voice right now" — we use it to drive ambient
// speaking cues (glow intensity + subtle face scale) instead of a rigid mouth
// overlay that never lines up perfectly on a 3D portrait.
const VISEME_AMPLITUDE: Record<Viseme, number> = {
  rest: 0,
  mbp: 0.25,
  ee: 0.45,
  oh: 0.70,
  ah: 1.0,
};

export function AiTutorFace({ gender, viseme, speaking, personaName }: AiTutorFaceProps) {
  const isMale = gender === "Male";
  const isEva = personaName === "Eva";
  // Eva has her own portrait so she doesn't visually clash with Afi K (also female).
  const imgSrc = isEva ? evaSrc : isMale ? maleSrc : femaleSrc;

  // Amplitude in [0..1] — drives the underglow intensity and a tiny face
  // breathe-scale. When not speaking we ease back to 0 (resting).
  const amp = speaking ? VISEME_AMPLITUDE[viseme] : 0;

  // Subtle "breathing" scale — caps at 1.025 even at peak amplitude so the
  // face never looks like it's pumping. Always a touch of motion when speaking
  // even at low amplitude, so the persona feels alive rather than frozen.
  const breatheScale = speaking ? 1 + 0.012 + amp * 0.013 : 1;

  // Underglow color shifts slightly per persona to match the avatar's accent.
  // Eva/female → cool violet-cyan; Male/Dude → warmer indigo-blue.
  const glowRgb = isMale ? "120, 170, 255" : "180, 140, 255";

  // The underglow opacity ramps with amplitude so loud syllables visibly
  // brighten the chin/jaw area. Even at rest while speaking we keep a soft
  // ambient glow so silences between words don't feel dead.
  const glowOpacity = speaking ? 0.18 + amp * 0.42 : 0;
  const glowBlur = 14 + amp * 10;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 50% 38%, #1d1a2e 0%, #15131f 55%, #0d0b14 100%)",
        boxShadow:
          "inset 0 2px 6px rgba(255,255,255,0.04), inset 0 -3px 8px rgba(0,0,0,0.55)",
      }}
    >
      {/* Soft violet halo behind the head */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 55% at 50% 40%, rgba(120,90,200,0.18) 0%, rgba(120,90,200,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Portrait — gently breathes when speaking. Smooth easing so it
          feels organic rather than bouncing per-viseme. */}
      <img
        src={imgSrc}
        alt={`${gender} AI tutor`}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "50% 18%",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
          transform: `scale(${breatheScale})`,
          transformOrigin: "50% 55%",
          transition: "transform 140ms cubic-bezier(0.33, 1, 0.68, 1)",
        }}
      />

      {/* Chin/jaw underglow — pulses with the voice amplitude. Sits over the
          mouth area so the persona's lips appear to brighten when speaking,
          without any rigid overlay shape that could misalign. The radial
          gradient + blur make it look like internal lighting rather than a
          painted spot. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "62%",
          transform: "translate(-50%, -50%)",
          width: "55%",
          height: "30%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, rgba(${glowRgb}, ${glowOpacity}) 0%, rgba(${glowRgb}, 0) 70%)`,
          filter: `blur(${glowBlur}px)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
          transition: "opacity 90ms linear, filter 140ms ease-out",
          opacity: speaking ? 1 : 0,
        }}
      />

      {/* Listening/idle ambient sparkle — extremely subtle so the face
          never feels static even between turns. */}
      {!speaking && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 60%, rgba(0,225,255,0.05) 0%, rgba(0,225,255,0) 55%)",
            pointerEvents: "none",
            animation: "ai-tutor-idle-pulse 4s ease-in-out infinite",
          }}
        />
      )}

      <style>{`
        @keyframes ai-tutor-idle-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
