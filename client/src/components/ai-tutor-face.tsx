import type { Viseme, MouthShape } from "@/lib/ai-tutor/lipsync";
import { MOUTH_SHAPES } from "@/lib/ai-tutor/lipsync";
import femaleSrc from "@assets/ai-tutor-female.png";
import maleSrc from "@assets/ai-tutor-male.png";

interface AiTutorFaceProps {
  gender: "Male" | "Female";
  viseme: Viseme;
  speaking: boolean;
}

export function AiTutorFace({ gender, viseme, speaking }: AiTutorFaceProps) {
  const ms = MOUTH_SHAPES[speaking ? viseme : "rest"];
  const isMale = gender === "Male";
  const imgSrc = isMale ? maleSrc : femaleSrc;

  const mouthX = isMale ? 100 : 96;
  const mouthY = isMale ? 130 : 122;
  const mouthW = 44;
  const skinColor = isMale ? "#b8956e" : "#c8977a";
  const skinColorEdge = isMale ? "rgba(168,128,90,0)" : "rgba(192,138,106,0)";
  const gradId = isMale ? "skin-cover-m" : "skin-cover-f";
  const lipU = isMale ? "#a87865" : "#cc7080";
  const lipL = isMale ? "#bf9080" : "#d990a0";
  const sx = mouthW / 60;
  const sy = 0.75;
  const tx = mouthX - 30 * sx;
  const ty = mouthY - 14 * sy;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: "50%" }}>
      <img
        src={imgSrc}
        alt={`${gender} AI tutor`}
        style={{
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

        {/* Skin-blend patch to cover original closed-mouth smile */}
        <ellipse
          cx={mouthX}
          cy={mouthY + 1}
          rx={28}
          ry={11}
          fill={`url(#${gradId})`}
          opacity={speaking ? 0.9 : 0.6}
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
