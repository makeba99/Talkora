import type { Viseme, MouthShape } from "@/lib/ai-tutor/lipsync";
import { MOUTH_SHAPES } from "@/lib/ai-tutor/lipsync";
import femaleSrc from "@assets/ai-tutor-female-neumorphic.png";
import maleSrc from "@assets/ai-tutor-male-neumorphic.png";

interface AiTutorFaceProps {
  gender: "Male" | "Female";
  viseme: Viseme;
  speaking: boolean;
}

export function AiTutorFace({ gender, viseme, speaking }: AiTutorFaceProps) {
  const ms = MOUTH_SHAPES[speaking ? viseme : "rest"];
  const isMale = gender === "Male";
  const imgSrc = isMale ? maleSrc : femaleSrc;

  // Mouth coordinates measured against the actual neumorphic portraits
  // (both 1024x1024 source images mapped into a 200x200 SVG viewBox).
  // viewBox-x = image-x / 1024 * 200, same for y.
  const mouthX = isMale ? 101 : 101;
  const mouthY = isMale ? 129 : 121;
  const mouthW = isMale ? 26 : 24;
  // Skin-blend ellipse colors — match each character's face tone so the
  // patch covering their natural closed mouth disappears into their skin.
  const skinColor = isMale ? "#d4a487" : "#f0c8b8";
  const skinColorEdge = isMale ? "rgba(212,164,135,0)" : "rgba(240,200,184,0)";
  const gradId = isMale ? "skin-cover-m" : "skin-cover-f";
  // Lip colors for the animated overlay — tuned to each character's natural lips.
  const lipU = isMale ? "#b07a6a" : "#d8788a";
  const lipL = isMale ? "#c89080" : "#e6909e";
  const sx = mouthW / 60;
  const sy = 0.75;
  const tx = mouthX - 30 * sx;
  const ty = mouthY - 14 * sy;

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
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 55% at 50% 40%, rgba(120,90,200,0.18) 0%, rgba(120,90,200,0) 70%)",
          pointerEvents: "none",
        }}
      />
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
        }}
      />

      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={skinColor} stopOpacity="1" />
            <stop offset="65%" stopColor={skinColor} stopOpacity="0.95" />
            <stop offset="100%" stopColor={skinColorEdge} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Skin-blend patch to cover original closed-mouth smile.
            Sized to roughly the natural mouth + a soft halo so edges fade. */}
        <ellipse
          cx={mouthX}
          cy={mouthY + 1}
          rx={isMale ? 18 : 16}
          ry={isMale ? 8 : 7}
          fill={`url(#${gradId})`}
          opacity={speaking ? 0.85 : 0.55}
        />

        {/* Animated mouth group */}
        <g transform={`translate(${tx}, ${ty}) scale(${sx}, ${sy})`}>
          <ellipse cx="30" cy={ms.innerCy} rx={ms.innerRx} ry={ms.innerRy} fill={ms.innerFill} />
          <path d={ms.upperLip} fill={lipU} opacity="0.92" />
          <path d={ms.lowerLip} fill={lipL} opacity="0.92" />
        </g>
      </svg>
    </div>
  );
}
