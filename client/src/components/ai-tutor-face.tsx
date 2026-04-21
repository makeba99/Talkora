import type { Viseme, MouthShape } from "@/lib/ai-tutor/lipsync";
import { MOUTH_SHAPES } from "@/lib/ai-tutor/lipsync";

interface AiTutorFaceProps {
  gender: "Male" | "Female";
  viseme: Viseme;
  speaking: boolean;
}

export function AiTutorFace({ gender, viseme, speaking }: AiTutorFaceProps) {
  const ms = MOUTH_SHAPES[speaking ? viseme : "rest"];
  return gender === "Male"
    ? <MaleFace ms={ms} />
    : <FemaleFace ms={ms} />;
}

function MaleFace({ ms }: { ms: MouthShape }) {
  return (
    <svg viewBox="0 0 200 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <radialGradient id="m-bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#0a1828" />
          <stop offset="100%" stopColor="#020810" />
        </radialGradient>
        <radialGradient id="m-skin" cx="44%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#f0cca8" />
          <stop offset="35%" stopColor="#d8a882" />
          <stop offset="70%" stopColor="#c09068" />
          <stop offset="100%" stopColor="#a07050" />
        </radialGradient>
        <radialGradient id="m-skin-side" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </radialGradient>
        <radialGradient id="m-hair" cx="50%" cy="15%" r="60%">
          <stop offset="0%" stopColor="#3c2c20" />
          <stop offset="45%" stopColor="#1e1410" />
          <stop offset="100%" stopColor="#0c0908" />
        </radialGradient>
        <radialGradient id="m-iris-l" cx="40%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#7090a8" />
          <stop offset="50%" stopColor="#3a5c78" />
          <stop offset="100%" stopColor="#0e1e2c" />
        </radialGradient>
        <radialGradient id="m-iris-r" cx="40%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#7090a8" />
          <stop offset="50%" stopColor="#3a5c78" />
          <stop offset="100%" stopColor="#0e1e2c" />
        </radialGradient>
        <linearGradient id="m-lip-u" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#b07868" />
          <stop offset="100%" stopColor="#986050" />
        </linearGradient>
        <linearGradient id="m-lip-l" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a87060" />
          <stop offset="100%" stopColor="#c09080" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="200" height="220" fill="url(#m-bg)" />

      {/* Dark suit collar */}
      <path d="M 48 220 L 56 190 Q 100 208 144 190 L 152 220 Z" fill="#0e1828" />
      <path d="M 80 220 L 88 196 L 100 205 L 112 196 L 120 220 Z" fill="#1a2a3c" />
      <line x1="100" y1="205" x2="100" y2="220" stroke="#263848" strokeWidth="1" opacity="0.5" />

      {/* Neck */}
      <path d="M 82 185 Q 82 200 85 210 L 115 210 Q 118 200 118 185 Z" fill="url(#m-skin)" />
      <ellipse cx="100" cy="184" rx="18" ry="6" fill="#c09068" />

      {/* Hair — short dark, structured */}
      <ellipse cx="100" cy="68" rx="60" ry="48" fill="url(#m-hair)" />
      {/* Hair sides */}
      <rect x="40" y="70" width="13" height="40" rx="5" fill="#1e1410" />
      <rect x="147" y="70" width="13" height="40" rx="5" fill="#1e1410" />
      {/* Hair hairline detail */}
      <path d="M 50 78 Q 65 60 82 62" stroke="#2e2018" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M 150 78 Q 135 60 118 62" stroke="#2e2018" strokeWidth="2" fill="none" opacity="0.6" />
      {/* Hair top texture */}
      <path d="M 68 55 Q 84 46 100 48 Q 116 46 132 55" stroke="#2e2018" strokeWidth="3" fill="none" opacity="0.4" />

      {/* Face head */}
      <ellipse cx="100" cy="122" rx="56" ry="70" fill="url(#m-skin)" />
      {/* Wider jaw, masculine */}
      <path d="M 48 148 Q 50 185 100 193 Q 150 185 152 148 Q 130 168 100 172 Q 70 168 48 148 Z" fill="url(#m-skin)" />
      {/* Side face depth shading */}
      <ellipse cx="52" cy="128" rx="20" ry="46" fill="url(#m-skin-side)" />
      <ellipse cx="148" cy="128" rx="20" ry="46" fill="url(#m-skin-side)" />
      {/* Forehead highlight */}
      <ellipse cx="100" cy="90" rx="32" ry="18" fill="rgba(255,220,180,0.12)" />
      {/* Temple hollows */}
      <ellipse cx="57" cy="110" rx="10" ry="14" fill="rgba(0,0,0,0.09)" />
      <ellipse cx="143" cy="110" rx="10" ry="14" fill="rgba(0,0,0,0.09)" />
      {/* Cheekbone shading */}
      <ellipse cx="62" cy="138" rx="18" ry="12" fill="rgba(0,0,0,0.07)" />
      <ellipse cx="138" cy="138" rx="18" ry="12" fill="rgba(0,0,0,0.07)" />
      {/* Jaw shadow / subtle stubble */}
      <ellipse cx="100" cy="168" rx="44" ry="20" fill="rgba(60,40,20,0.20)" />
      <ellipse cx="78" cy="165" rx="16" ry="10" fill="rgba(60,40,20,0.10)" />
      <ellipse cx="122" cy="165" rx="16" ry="10" fill="rgba(60,40,20,0.10)" />
      {/* Under-chin shadow */}
      <ellipse cx="100" cy="183" rx="28" ry="8" fill="rgba(0,0,0,0.18)" />

      {/* ── Eyebrows — thick, straight-ish, masculine ── */}
      <path d="M 63 91 Q 76 87 92 89" stroke="#1c1408" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M 108 89 Q 124 87 137 91" stroke="#1c1408" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      {/* Brow ridge subtle shadow */}
      <path d="M 63 93 Q 76 90 92 92" stroke="rgba(0,0,0,0.12)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M 108 92 Q 124 90 137 93" stroke="rgba(0,0,0,0.12)" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* ── Left eye ── */}
      {/* Eye socket shadow */}
      <ellipse cx="78" cy="106" rx="17" ry="13" fill="rgba(80,40,20,0.13)" />
      {/* Sclera */}
      <ellipse cx="78" cy="104" rx="13" ry="10" fill="#f5f0ea" />
      {/* Pink corner */}
      <ellipse cx="66" cy="104" rx="4" ry="3.5" fill="rgba(220,160,140,0.30)" />
      {/* Iris */}
      <ellipse cx="78" cy="104" rx="9" ry="9" fill="#0e1c28" />
      <ellipse cx="78" cy="104" rx="8.5" ry="8.5" fill="url(#m-iris-l)" />
      {/* Pupil */}
      <ellipse cx="78" cy="104" rx="4.8" ry="4.8" fill="#060c12" />
      {/* Primary specular */}
      <ellipse cx="81.5" cy="100.5" rx="2.6" ry="2.0" fill="rgba(255,255,255,0.88)" style={{ transform: "rotate(-20deg)", transformOrigin: "81.5px 100.5px" }} />
      {/* Secondary specular */}
      <circle cx="74.5" cy="108" r="1.1" fill="rgba(255,255,255,0.38)" />
      {/* Upper lash line */}
      <path d="M 65 100 Q 78 95 91 100" stroke="#0e0c0a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* Lower lid subtle */}
      <path d="M 65 108 Q 78 112 91 108" stroke="rgba(160,120,100,0.35)" strokeWidth="0.8" fill="none" strokeLinecap="round" />

      {/* ── Right eye ── */}
      <ellipse cx="122" cy="106" rx="17" ry="13" fill="rgba(80,40,20,0.13)" />
      <ellipse cx="122" cy="104" rx="13" ry="10" fill="#f5f0ea" />
      <ellipse cx="134" cy="104" rx="4" ry="3.5" fill="rgba(220,160,140,0.30)" />
      <ellipse cx="122" cy="104" rx="9" ry="9" fill="#0e1c28" />
      <ellipse cx="122" cy="104" rx="8.5" ry="8.5" fill="url(#m-iris-r)" />
      <ellipse cx="122" cy="104" rx="4.8" ry="4.8" fill="#060c12" />
      <ellipse cx="125.5" cy="100.5" rx="2.6" ry="2.0" fill="rgba(255,255,255,0.88)" style={{ transform: "rotate(-20deg)", transformOrigin: "125.5px 100.5px" }} />
      <circle cx="118.5" cy="108" r="1.1" fill="rgba(255,255,255,0.38)" />
      <path d="M 109 100 Q 122 95 135 100" stroke="#0e0c0a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M 109 108 Q 122 112 135 108" stroke="rgba(160,120,100,0.35)" strokeWidth="0.8" fill="none" strokeLinecap="round" />

      {/* Blink lids */}
      <ellipse className="ai-avatar-blink" cx="78" cy="104" rx="13" ry="10" fill="#c89870" />
      <ellipse className="ai-avatar-blink" cx="122" cy="104" rx="13" ry="10" fill="#c89870" style={{ animationDelay: "0.07s" }} />

      {/* ── Nose — realistic shadow-only rendering ── */}
      {/* Nose bridge shadow */}
      <path d="M 95 115 Q 93 132 94 140" stroke="rgba(120,80,50,0.22)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 105 115 Q 107 132 106 140" stroke="rgba(120,80,50,0.22)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Nostril wings */}
      <ellipse cx="93" cy="143" rx="5.5" ry="3.5" fill="rgba(110,70,45,0.28)" />
      <ellipse cx="107" cy="143" rx="5.5" ry="3.5" fill="rgba(110,70,45,0.28)" />
      {/* Nose tip highlight */}
      <ellipse cx="100" cy="138" rx="5" ry="3.5" fill="rgba(255,210,170,0.18)" />
      {/* Philtrum shadow */}
      <path d="M 96 148 Q 100 152 104 148" stroke="rgba(120,80,55,0.18)" strokeWidth="2" fill="none" />

      {/* ── Mouth — viseme driven ── */}
      <g transform="translate(74.5, 146) scale(0.818, 0.693)">
        <ellipse cx="30" cy={ms.innerCy} rx={ms.innerRx} ry={ms.innerRy} fill={ms.innerFill} />
        <path d={ms.upperLip} fill="url(#m-lip-u)" stroke="rgba(90,35,25,0.18)" strokeWidth="0.5" />
        <path d={ms.lowerLip} fill="url(#m-lip-l)" stroke="rgba(90,35,25,0.12)" strokeWidth="0.5" />
      </g>

      {/* ── Headset — teal/cyan ── */}
      <path d="M 28 106 Q 28 56 100 52 Q 172 56 172 106" fill="none" stroke="#0e9ab2" strokeWidth="5.5" strokeLinecap="round" />
      {/* Left earpiece */}
      <rect x="22" y="101" width="14" height="18" rx="5" fill="#0a7888" />
      <rect x="24" y="103" width="10" height="14" rx="3" fill="#18c8e0" />
      <ellipse cx="29" cy="110" rx="3.5" ry="4.5" fill="rgba(0,200,240,0.25)" />
      {/* Right earpiece */}
      <rect x="164" y="101" width="14" height="18" rx="5" fill="#0a7888" />
      <rect x="166" y="103" width="10" height="14" rx="3" fill="#18c8e0" />
      <ellipse cx="171" cy="110" rx="3.5" ry="4.5" fill="rgba(0,200,240,0.25)" />

      {/* Scan-line holographic overlay */}
      <rect width="200" height="220" fill="none"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,225,255,0.006) 3px, rgba(0,225,255,0.006) 4px)" }}
        opacity="0.5" />
    </svg>
  );
}

function FemaleFace({ ms }: { ms: MouthShape }) {
  return (
    <svg viewBox="0 0 200 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <radialGradient id="f-bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1a0838" />
          <stop offset="100%" stopColor="#050212" />
        </radialGradient>
        <radialGradient id="f-skin" cx="44%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#fde8cc" />
          <stop offset="35%" stopColor="#f0c8a0" />
          <stop offset="70%" stopColor="#d8a878" />
          <stop offset="100%" stopColor="#b88055" />
        </radialGradient>
        <radialGradient id="f-skin-side" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </radialGradient>
        <radialGradient id="f-hair" cx="50%" cy="12%" r="62%">
          <stop offset="0%" stopColor="#e8f0ff" />
          <stop offset="40%" stopColor="#b8c8e8" />
          <stop offset="80%" stopColor="#7888b8" />
          <stop offset="100%" stopColor="#485878" />
        </radialGradient>
        <radialGradient id="f-iris-l" cx="38%" cy="35%" r="58%">
          <stop offset="0%" stopColor="#90c0e8" />
          <stop offset="45%" stopColor="#3878c0" />
          <stop offset="100%" stopColor="#0a2060" />
        </radialGradient>
        <radialGradient id="f-iris-r" cx="38%" cy="35%" r="58%">
          <stop offset="0%" stopColor="#90c0e8" />
          <stop offset="45%" stopColor="#3878c0" />
          <stop offset="100%" stopColor="#0a2060" />
        </radialGradient>
        <linearGradient id="f-lip-u" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e08898" />
          <stop offset="100%" stopColor="#c86878" />
        </linearGradient>
        <linearGradient id="f-lip-l" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d07888" />
          <stop offset="100%" stopColor="#e8a0a8" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="200" height="220" fill="url(#f-bg)" />

      {/* Dark blazer/suit */}
      <path d="M 46 220 L 55 188 Q 100 210 145 188 L 154 220 Z" fill="#1a1040" />
      <path d="M 80 220 L 88 198 L 100 207 L 112 198 L 120 220 Z" fill="#241858" />
      <line x1="100" y1="207" x2="100" y2="220" stroke="#302068" strokeWidth="1" opacity="0.5" />

      {/* Neck */}
      <path d="M 84 182 Q 83 196 86 208 L 114 208 Q 117 196 116 182 Z" fill="url(#f-skin)" />
      <ellipse cx="100" cy="181" rx="16" ry="5" fill="#d8a878" />

      {/* Hair back layer — long silver */}
      <ellipse cx="100" cy="76" rx="64" ry="56" fill="url(#f-hair)" opacity="0.92" />
      {/* Long hair flowing down sides */}
      <path d="M 38 100 Q 24 152 30 215 L 50 215 Q 44 158 54 104 Z" fill="#b8c8e8" />
      <path d="M 162 100 Q 176 152 170 215 L 150 215 Q 156 158 146 104 Z" fill="#b8c8e8" />
      {/* Hair highlights — strand catching light */}
      <path d="M 42 104 Q 32 155 36 212" stroke="#ddeeff" strokeWidth="2.5" fill="none" opacity="0.55" />
      <path d="M 47 102 Q 38 153 42 208" stroke="#ccddf0" strokeWidth="1.5" fill="none" opacity="0.35" />
      <path d="M 158 104 Q 168 155 164 212" stroke="#ddeeff" strokeWidth="2.5" fill="none" opacity="0.55" />

      {/* Face — oval, feminine */}
      <ellipse cx="100" cy="118" rx="57" ry="72" fill="url(#f-skin)" />
      {/* Soft oval chin */}
      <ellipse cx="100" cy="178" rx="38" ry="15" fill="url(#f-skin)" />
      {/* Side face depth */}
      <ellipse cx="51" cy="123" rx="20" ry="46" fill="url(#f-skin-side)" />
      <ellipse cx="149" cy="123" rx="20" ry="46" fill="url(#f-skin-side)" />
      {/* Forehead highlight */}
      <ellipse cx="100" cy="88" rx="30" ry="16" fill="rgba(255,235,200,0.14)" />
      {/* Cheekbone highlight */}
      <ellipse cx="68" cy="134" rx="18" ry="10" fill="rgba(255,200,160,0.10)" />
      <ellipse cx="132" cy="134" rx="18" ry="10" fill="rgba(255,200,160,0.10)" />
      {/* Under-chin shadow */}
      <ellipse cx="100" cy="181" rx="26" ry="7" fill="rgba(0,0,0,0.14)" />

      {/* Hair front — bangs over forehead */}
      <path d="M 36 96 Q 50 44 100 40 Q 150 44 164 96 Q 150 64 100 62 Q 50 64 36 96 Z" fill="url(#f-hair)" opacity="0.90" />
      {/* Bang strand details */}
      <path d="M 52 66 Q 64 52 78 56" stroke="#ccdaf0" strokeWidth="1.8" fill="none" opacity="0.55" />
      <path d="M 148 66 Q 136 52 122 56" stroke="#ccdaf0" strokeWidth="1.8" fill="none" opacity="0.55" />
      <path d="M 44 76 Q 54 60 68 64" stroke="#b8cce8" strokeWidth="1.2" fill="none" opacity="0.4" />
      <path d="M 156 76 Q 146 60 132 64" stroke="#b8cce8" strokeWidth="1.2" fill="none" opacity="0.4" />

      {/* ── Eyebrows — thin, gracefully arched ── */}
      <path d="M 64 90 Q 79 84 93 87" stroke="#607090" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M 107 87 Q 121 84 136 90" stroke="#607090" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* Brow arch shadow */}
      <path d="M 64 92 Q 79 87 93 90" stroke="rgba(0,0,0,0.10)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 107 90 Q 121 87 136 92" stroke="rgba(0,0,0,0.10)" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* ── Left eye — large, feminine ── */}
      {/* Eye socket shadow */}
      <ellipse cx="78" cy="103" rx="18" ry="13.5" fill="rgba(80,40,20,0.12)" />
      {/* Sclera */}
      <ellipse cx="78" cy="101" rx="14" ry="11.5" fill="#f8f2ec" />
      {/* Pink corner */}
      <ellipse cx="65" cy="101" rx="4.5" ry="3.5" fill="rgba(220,150,140,0.28)" />
      {/* Iris outer (limbal ring) */}
      <ellipse cx="78" cy="101" rx="10" ry="10" fill="#0c1a30" />
      {/* Iris color */}
      <ellipse cx="78" cy="101" rx="9.5" ry="9.5" fill="url(#f-iris-l)" />
      {/* Pupil */}
      <ellipse cx="78" cy="101" rx="5.2" ry="5.2" fill="#06080e" />
      {/* Catchlight primary */}
      <ellipse cx="82" cy="97" rx="3.0" ry="2.2" fill="rgba(255,255,255,0.92)" style={{ transform: "rotate(-18deg)", transformOrigin: "82px 97px" }} />
      {/* Catchlight secondary */}
      <circle cx="74" cy="106" r="1.2" fill="rgba(255,255,255,0.40)" />
      {/* Upper lash line */}
      <path d="M 64 97 Q 78 92 92 97" stroke="#0a0810" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Upper lashes (female longer) */}
      <path d="M 64 97 L 62.5 93.5" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 67 95.5 L 66 92" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 70 94 L 69.5 90.5" stroke="#0a0810" strokeWidth="1.0" fill="none" strokeLinecap="round" />
      <path d="M 92 97 L 93.5 93.5" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 89 95.5 L 90 92" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* Lower lid */}
      <path d="M 64 105 Q 78 110 92 105" stroke="rgba(150,100,85,0.35)" strokeWidth="0.9" fill="none" strokeLinecap="round" />

      {/* ── Right eye ── */}
      <ellipse cx="122" cy="103" rx="18" ry="13.5" fill="rgba(80,40,20,0.12)" />
      <ellipse cx="122" cy="101" rx="14" ry="11.5" fill="#f8f2ec" />
      <ellipse cx="135" cy="101" rx="4.5" ry="3.5" fill="rgba(220,150,140,0.28)" />
      <ellipse cx="122" cy="101" rx="10" ry="10" fill="#0c1a30" />
      <ellipse cx="122" cy="101" rx="9.5" ry="9.5" fill="url(#f-iris-r)" />
      <ellipse cx="122" cy="101" rx="5.2" ry="5.2" fill="#06080e" />
      <ellipse cx="126" cy="97" rx="3.0" ry="2.2" fill="rgba(255,255,255,0.92)" style={{ transform: "rotate(-18deg)", transformOrigin: "126px 97px" }} />
      <circle cx="118" cy="106" r="1.2" fill="rgba(255,255,255,0.40)" />
      <path d="M 108 97 Q 122 92 136 97" stroke="#0a0810" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M 108 97 L 106.5 93.5" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 111 95.5 L 110 92" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 114 94 L 113.5 90.5" stroke="#0a0810" strokeWidth="1.0" fill="none" strokeLinecap="round" />
      <path d="M 136 97 L 137.5 93.5" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 133 95.5 L 134 92" stroke="#0a0810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 108 105 Q 122 110 136 105" stroke="rgba(150,100,85,0.35)" strokeWidth="0.9" fill="none" strokeLinecap="round" />

      {/* Blink lids */}
      <ellipse className="ai-avatar-blink" cx="78" cy="101" rx="14" ry="11.5" fill="#eec09a" />
      <ellipse className="ai-avatar-blink" cx="122" cy="101" rx="14" ry="11.5" fill="#eec09a" style={{ animationDelay: "0.07s" }} />

      {/* Subtle cheek blush */}
      <ellipse cx="60" cy="122" rx="17" ry="8.5" fill="rgba(255,120,100,0.14)" />
      <ellipse cx="140" cy="122" rx="17" ry="8.5" fill="rgba(255,120,100,0.14)" />

      {/* ── Nose — shadow-only rendering ── */}
      <path d="M 96 114 Q 94 130 95 138" stroke="rgba(140,90,60,0.20)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 104 114 Q 106 130 105 138" stroke="rgba(140,90,60,0.20)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="94" cy="140" rx="4.5" ry="3" fill="rgba(130,80,55,0.22)" />
      <ellipse cx="106" cy="140" rx="4.5" ry="3" fill="rgba(130,80,55,0.22)" />
      {/* Nose tip highlight */}
      <ellipse cx="100" cy="136" rx="4.5" ry="3.5" fill="rgba(255,225,190,0.20)" />
      {/* Philtrum */}
      <path d="M 97 146 Q 100 150 103 146" stroke="rgba(150,90,70,0.16)" strokeWidth="1.8" fill="none" />

      {/* ── Mouth — viseme driven ── */}
      <g transform="translate(74.5, 144) scale(0.818, 0.693)">
        <ellipse cx="30" cy={ms.innerCy} rx={ms.innerRx} ry={ms.innerRy} fill={ms.innerFill} />
        <path d={ms.upperLip} fill="url(#f-lip-u)" stroke="rgba(120,40,55,0.20)" strokeWidth="0.5" />
        <path d={ms.lowerLip} fill="url(#f-lip-l)" stroke="rgba(120,40,55,0.14)" strokeWidth="0.5" />
      </g>
      {/* Lip highlight */}
      <ellipse cx="100" cy="152" rx="9" ry="2.5" fill="rgba(255,200,210,0.18)" />

      {/* ── Headset — purple/violet ── */}
      <path d="M 28 104 Q 28 56 100 52 Q 172 56 172 104" fill="none" stroke="#5058c8" strokeWidth="5.5" strokeLinecap="round" />
      {/* Left earpiece */}
      <rect x="22" y="99" width="14" height="18" rx="5" fill="#3840a8" />
      <rect x="24" y="101" width="10" height="14" rx="3" fill="#6870e8" />
      <ellipse cx="29" cy="108" rx="3.5" ry="4.5" fill="rgba(100,120,255,0.25)" />
      {/* Right earpiece */}
      <rect x="164" y="99" width="14" height="18" rx="5" fill="#3840a8" />
      <rect x="166" y="101" width="10" height="14" rx="3" fill="#6870e8" />
      <ellipse cx="171" cy="108" rx="3.5" ry="4.5" fill="rgba(100,120,255,0.25)" />
    </svg>
  );
}
