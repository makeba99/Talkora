import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  speed: number;
  twinkleOffset: number;
  color: string;
}

const STAR_COLORS_STARFIELD = ["#ffffff", "#e0f0ff", "#c8e0ff", "#93c5fd", "#c4b5fd"];
const STAR_COLORS_GALAXY    = ["#ffffff", "#e9d5ff", "#c084fc", "#f0abfc", "#a78bfa", "#fbcfe8"];

function buildStars(count: number, w: number, h: number, colors: string[]): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.4 + 0.2,
    opacity: Math.random() * 0.6 + 0.2,
    speed: Math.random() * 0.06 + 0.01,
    twinkleOffset: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

export function AnimatedBackground() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const starsRef  = useRef<Star[]>([]);
  const timeRef   = useRef(0);

  const active = theme === "starfield" || theme === "galaxy";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const colors  = theme === "galaxy" ? STAR_COLORS_GALAXY : STAR_COLORS_STARFIELD;
      const count   = theme === "galaxy" ? 260 : 380;
      starsRef.current = buildStars(count, canvas.width, canvas.height, colors);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      timeRef.current += 0.012;
      const t = timeRef.current;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      if (theme === "galaxy") {
        const grd = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, W * 0.7);
        grd.addColorStop(0,   "rgba(90,30,130,0.18)");
        grd.addColorStop(0.4, "rgba(60,10,100,0.10)");
        grd.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        const grd2 = ctx.createRadialGradient(W * 0.2, H * 0.7, 0, W * 0.2, H * 0.7, W * 0.5);
        grd2.addColorStop(0,   "rgba(150,40,200,0.10)");
        grd2.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = grd2;
        ctx.fillRect(0, 0, W, H);
      }

      starsRef.current.forEach((s) => {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.8 + s.twinkleOffset);
        const opacity = s.opacity * (0.5 + 0.5 * twinkle);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = opacity;
        ctx.fill();

        if (s.r > 0.9 && theme === "galaxy") {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = opacity * 0.15;
          ctx.fill();
        }

        s.y -= s.speed;
        if (s.y < -2) {
          s.y = H + 2;
          s.x = Math.random() * W;
        }
      });

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [theme, active]);

  if (!active) return null;

  return (
    <canvas
      id="animated-bg-canvas"
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
}
