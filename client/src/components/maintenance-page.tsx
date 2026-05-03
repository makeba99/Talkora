import { useEffect, useRef } from "react";

export function MaintenancePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let w = 0, h = 0;

    interface Star {
      x: number; y: number; z: number; pz: number;
    }
    interface Particle {
      x: number; y: number; vx: number; vy: number;
      alpha: number; radius: number; hue: number;
    }
    interface Ring {
      radius: number; maxRadius: number; alpha: number; speed: number; hue: number;
    }

    const STAR_COUNT = 180;
    const stars: Star[] = [];
    const particles: Particle[] = [];
    const rings: Ring[] = [];

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }

    function initStars() {
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * w - w / 2,
          y: Math.random() * h - h / 2,
          z: Math.random() * w,
          pz: 0,
        });
      }
    }

    function spawnParticle() {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.8;
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * 200,
        y: h / 2 + (Math.random() - 0.5) * 200,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.7 + Math.random() * 0.3,
        radius: 1.5 + Math.random() * 3,
        hue: 200 + Math.random() * 80,
      });
    }

    function spawnRing() {
      rings.push({
        radius: 40,
        maxRadius: 220 + Math.random() * 120,
        alpha: 0.55,
        speed: 0.8 + Math.random() * 0.6,
        hue: 190 + Math.random() * 70,
      });
    }

    resize();
    initStars();
    spawnRing();

    let particleTimer = 0;
    let ringTimer = 0;

    function draw(ts: number) {
      if (!ctx) return;

      ctx.fillStyle = "rgba(6, 4, 20, 0.18)";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2, h / 2);

      for (const s of stars) {
        s.pz = s.z;
        s.z -= 2.5;
        if (s.z <= 0) {
          s.x = Math.random() * w - w / 2;
          s.y = Math.random() * h - h / 2;
          s.z = w;
          s.pz = s.z;
        }
        const sx = (s.x / s.z) * w;
        const sy = (s.y / s.z) * w;
        const px = (s.x / s.pz) * w;
        const py = (s.y / s.pz) * w;
        const alpha = (1 - s.z / w) * 0.9 + 0.1;
        const size = Math.max(0.4, (1 - s.z / w) * 2.5);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = `rgba(180,200,255,${alpha})`;
        ctx.lineWidth = size;
        ctx.stroke();
      }
      ctx.restore();

      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.radius += r.speed;
        r.alpha -= r.alpha * 0.012;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${r.hue},90%,70%,${r.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (r.radius >= r.maxRadius || r.alpha < 0.01) {
          rings.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.006;
        p.alpha -= 0.007;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},90%,75%,${Math.max(0, p.alpha)})`;
        ctx.fill();
        if (p.alpha <= 0) particles.splice(i, 1);
      }

      particleTimer += 16;
      if (particleTimer > 80) { spawnParticle(); particleTimer = 0; }
      ringTimer += 16;
      if (ringTimer > 2400) { spawnRing(); ringTimer = 0; }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", () => { resize(); initStars(); });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", () => { resize(); initStars(); });
    };
  }, []);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#060414]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center select-none">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute w-40 h-40 rounded-full animate-ping"
            style={{
              background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
              animationDuration: "2.4s",
            }}
          />
          <div
            className="absolute w-28 h-28 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
              animation: "pulse 1.8s ease-in-out infinite",
            }}
          />
          <div
            className="relative flex items-center justify-center w-20 h-20 rounded-full border border-violet-500/40"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))",
              boxShadow: "0 0 40px rgba(139,92,246,0.4), inset 0 0 20px rgba(99,102,241,0.15)",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="16" stroke="url(#grd)" strokeWidth="1.5" />
              <path
                d="M18 8 C13 8, 9 12, 9 17 C9 20, 10.5 22.5, 13 24 L18 28 L23 24 C25.5 22.5, 27 20, 27 17 C27 12, 23 8, 18 8 Z"
                fill="url(#grd2)"
                opacity="0.85"
              />
              <path
                d="M18 12 C18 12, 21 15, 21 18 C21 20.2 19.7 22 18 22 C16.3 22 15 20.2 15 18 C15 15, 18 12, 18 12 Z"
                fill="white"
                opacity="0.5"
              />
              <defs>
                <linearGradient id="grd" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#3B82F6" />
                </linearGradient>
                <linearGradient id="grd2" x1="9" y1="8" x2="27" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#A78BFA" />
                  <stop offset="1" stopColor="#60A5FA" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h1
            className="text-5xl sm:text-6xl font-black tracking-tight"
            style={{
              background: "linear-gradient(135deg, #e879f9 0%, #818cf8 40%, #38bdf8 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 24px rgba(139,92,246,0.5))",
            }}
          >
            Cooking Something Cool
          </h1>
          <p
            className="text-lg sm:text-xl font-medium"
            style={{ color: "rgba(196,181,253,0.85)" }}
          >
            We'll be back shortly — better than ever.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === 1 || i === 2 ? 10 : 7,
                height: i === 1 || i === 2 ? 10 : 7,
                background:
                  i === 0
                    ? "rgba(99,102,241,0.5)"
                    : i === 3
                    ? "rgba(99,102,241,0.5)"
                    : "linear-gradient(135deg,#a78bfa,#38bdf8)",
                animation: `pulse ${1.2 + i * 0.22}s ease-in-out infinite`,
                boxShadow: i === 1 || i === 2 ? "0 0 10px rgba(139,92,246,0.7)" : "none",
              }}
            />
          ))}
        </div>

        <div
          className="mt-4 rounded-2xl border px-6 py-3 text-sm"
          style={{
            borderColor: "rgba(139,92,246,0.25)",
            background: "rgba(139,92,246,0.08)",
            color: "rgba(196,181,253,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          🛠️ &nbsp; Under maintenance — hang tight, we move fast.
        </div>
      </div>
    </div>
  );
}
