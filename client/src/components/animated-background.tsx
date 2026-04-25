import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { isBackgroundPaused, onBackgroundPauseChange } from "@/lib/perf-bus";

type Ctx = CanvasRenderingContext2D;

/* ─────────────────────────────────────────────
   STARFIELD – 3-layer parallax + shooting stars
───────────────────────────────────────────── */
interface StarLayer { x: number; y: number; r: number; twinkle: number; color: string; }
interface Shooter  { x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number; }

const SF_COLORS = ["#fff","#e0f0ff","#c8dfff","#93c5fd","#c4b5fd","#f0e6ff"];

function buildStarLayers(W: number, H: number) {
  const far:  StarLayer[] = Array.from({ length: 220 }, () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*0.5+0.1, twinkle: Math.random()*Math.PI*2, color: "#cbd5e1" }));
  const mid:  StarLayer[] = Array.from({ length: 120 }, () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*0.7+0.3, twinkle: Math.random()*Math.PI*2, color: SF_COLORS[Math.floor(Math.random()*SF_COLORS.length)] }));
  const near: StarLayer[] = Array.from({ length: 55  }, () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.1+0.6, twinkle: Math.random()*Math.PI*2, color: SF_COLORS[Math.floor(Math.random()*SF_COLORS.length)] }));
  return { far, mid, near };
}

function drawStarfield(ctx: Ctx, W: number, H: number, t: number,
  layers: ReturnType<typeof buildStarLayers>, shooters: Shooter[]) {

  ctx.clearRect(0, 0, W, H);

  const drawLayer = (stars: StarLayer[], speed: number, baseAlpha: number) => {
    stars.forEach(s => {
      const a = baseAlpha * (0.6 + 0.4 * Math.sin(t * 1.4 + s.twinkle));
      ctx.globalAlpha = a;
      ctx.fillStyle   = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      s.y += speed;
      if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
    });
  };

  drawLayer(layers.far,  0.03, 0.45);
  drawLayer(layers.mid,  0.12, 0.70);
  drawLayer(layers.near, 0.28, 0.90);

  shooters.forEach((sh, i) => {
    sh.life--;
    sh.x += sh.vx; sh.y += sh.vy;
    const progress = sh.life / sh.maxLife;
    const grd = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * sh.len, sh.y - sh.vy * sh.len);
    grd.addColorStop(0,   `rgba(255,255,255,${progress * 0.9})`);
    grd.addColorStop(0.4, `rgba(180,220,255,${progress * 0.5})`);
    grd.addColorStop(1,   "rgba(180,220,255,0)");
    ctx.globalAlpha = 1;
    ctx.strokeStyle = grd;
    ctx.lineWidth   = sh.r ?? 1.5;
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.lineTo(sh.x - sh.vx * sh.len, sh.y - sh.vy * sh.len);
    ctx.stroke();
    if (sh.life <= 0) shooters.splice(i, 1);
  });

  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────
   GALAXY – rotating spiral arms + glowing core
───────────────────────────────────────────── */
interface GalaxyDot { dist: number; angle: number; r: number; color: string; alpha: number; }

const GALAXY_STAR_COLORS = ["#fff","#f5e6ff","#d8b4fe","#c084fc","#f0abfc","#fde8ff","#7dd3fc","#fbcfe8"];

function buildGalaxyArms(count: number): GalaxyDot[] {
  const dots: GalaxyDot[] = [];
  const arms = 2;
  for (let i = 0; i < count; i++) {
    const arm     = i % arms;
    const t       = (i / count) * 1.0;
    const dist    = 30 + t * 420 + (Math.random() - 0.5) * 60;
    const spin    = dist * 0.013;
    const scatter = (Math.random() - 0.5) * (0.3 + t * 1.2);
    const angle   = (arm / arms) * Math.PI * 2 + spin + scatter;
    const coreBlend = 1 - Math.min(1, dist / 300);
    const r = Math.random() * (1.4 + coreBlend * 1.8) + 0.3;
    const ci = Math.floor(Math.random() * GALAXY_STAR_COLORS.length);
    dots.push({ dist, angle, r, color: GALAXY_STAR_COLORS[ci], alpha: 0.3 + Math.random() * 0.55 });
  }
  return dots;
}

function drawGalaxy(ctx: Ctx, W: number, H: number, t: number, arms: GalaxyDot[]) {
  ctx.clearRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.5;
  const rotation = t * 0.012;

  const nebula = (ox: number, oy: number, r: number, col: string, a: number) => {
    const grd = ctx.createRadialGradient(cx+ox, cy+oy, 0, cx+ox, cy+oy, r);
    grd.addColorStop(0, col.replace(")", `,${a})`).replace("rgb","rgba"));
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd; ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
  };

  nebula(0,    0,    W*0.28, "rgb(100,20,160", 0.22);
  nebula(W*0.18, -H*0.12, W*0.20, "rgb(160,30,220", 0.14);
  nebula(-W*0.22, H*0.15, W*0.22, "rgb(60,10,130",  0.18);
  nebula(0, 0, W*0.10, "rgb(220,180,255", 0.25);

  arms.forEach(d => {
    const a   = d.angle + rotation;
    const px  = cx + Math.cos(a) * d.dist;
    const py  = cy + Math.sin(a) * d.dist * 0.45;
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle   = d.color;
    ctx.beginPath();
    ctx.arc(px, py, d.r, 0, Math.PI * 2);
    ctx.fill();
    if (d.r > 1.2) {
      ctx.globalAlpha = d.alpha * 0.18;
      ctx.beginPath();
      ctx.arc(px, py, d.r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
  core.addColorStop(0,   "rgba(255,245,255,0.85)");
  core.addColorStop(0.15,"rgba(230,180,255,0.55)");
  core.addColorStop(0.5, "rgba(140,60,200,0.25)");
  core.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle   = core;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────
   SYNTHWAVE – perspective grid + retro sun
───────────────────────────────────────────── */
function drawSynthwave(ctx: Ctx, W: number, H: number, t: number) {
  ctx.clearRect(0, 0, W, H);

  const HX = W * 0.5;
  const HY = H * 0.52;

  const sky = ctx.createLinearGradient(0, 0, 0, HY);
  sky.addColorStop(0,   "#050010");
  sky.addColorStop(0.5, "#1a0030");
  sky.addColorStop(1,   "#3a0050");
  ctx.fillStyle = sky; ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, W, HY);

  const floor = ctx.createLinearGradient(0, HY, 0, H);
  floor.addColorStop(0, "#1a0030");
  floor.addColorStop(1, "#050010");
  ctx.fillStyle = floor;
  ctx.fillRect(0, HY, W, H - HY);

  const sunR = Math.min(W, H) * 0.22;
  const sunX = HX, sunY = HY;
  const sunG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 1.3);
  sunG.addColorStop(0,   "#ffe680");
  sunG.addColorStop(0.25,"#ff8c40");
  sunG.addColorStop(0.55,"#ff3399");
  sunG.addColorStop(0.8, "#aa00cc");
  sunG.addColorStop(1,   "rgba(80,0,100,0)");
  ctx.fillStyle   = sunG;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, Math.PI, 0);
  ctx.lineTo(sunX + sunR, sunY);
  ctx.closePath();
  ctx.clip();

  const sunFill = ctx.createLinearGradient(sunX - sunR, 0, sunX + sunR, 0);
  sunFill.addColorStop(0,   "#ffee55");
  sunFill.addColorStop(0.5, "#ff8844");
  sunFill.addColorStop(1,   "#ff3399");
  ctx.fillStyle = sunFill; ctx.globalAlpha = 1;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR);

  const lineH = sunR / 10;
  for (let li = 0; li < 10; li++) {
    const ly = sunY - sunR + li * lineH * 2 + lineH * 0.4;
    if (ly > sunY) break;
    ctx.fillStyle   = "#1a0030";
    ctx.globalAlpha = 0.55 + li * 0.04;
    ctx.fillRect(sunX - sunR, ly, sunR * 2, lineH * 0.8);
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.8, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, "rgba(255,80,200,0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, W, H);

  const VCOLS = 18;
  const scroll = (t * 28) % 80;

  ctx.globalAlpha = 1;
  for (let xi = 0; xi <= VCOLS; xi++) {
    const fx = (xi / VCOLS) * W;
    const bright = 1 - Math.abs(xi / VCOLS - 0.5) * 1.5;
    ctx.strokeStyle = `rgba(255,0,180,${Math.max(0, bright * 0.65)})`;
    ctx.lineWidth   = 0.8;
    ctx.shadowColor = "#ff00cc";
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(HX + (fx - HX) * 0.02, HY);
    ctx.lineTo(fx, H);
    ctx.stroke();
  }

  const HROWS = 22;
  for (let yi = 0; yi < HROWS; yi++) {
    const rawT   = (yi / HROWS);
    const t2     = Math.pow(rawT, 2.2);
    const fy     = HY + (H - HY) * t2 + scroll * (1 - t2);
    if (fy > H) continue;
    const alpha  = rawT * 0.65 + 0.05;
    ctx.strokeStyle = `rgba(255,0,180,${alpha})`;
    ctx.lineWidth   = 0.6 + rawT;
    ctx.shadowColor = "#ff00cc";
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.moveTo(0, fy);
    ctx.lineTo(W, fy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  const mPts: [number, number][] = [];
  const mSegs = 28;
  for (let mi = 0; mi <= mSegs; mi++) {
    const mx = (mi / mSegs) * W;
    const seed1 = Math.sin(mi * 0.6 + 0.5) * 0.5 + Math.sin(mi * 1.1) * 0.3 + Math.sin(mi * 0.2) * 0.7;
    const mh = 28 + seed1 * 36;
    mPts.push([mx, HY - mh]);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle   = "#050010";
  ctx.beginPath();
  ctx.moveTo(0, H);
  mPts.forEach(([mx, my]) => ctx.lineTo(mx, my));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  for (let si = 0; si < 80; si++) {
    const sx = (Math.sin(si * 2.5 + 0.3) * 0.5 + 0.5) * W;
    const sy = (Math.sin(si * 1.7 + 1.1) * 0.5 + 0.5) * HY * 0.9;
    const sr = Math.random() * 0.6 + 0.15;
    ctx.globalAlpha = 0.3 + Math.sin(t + si) * 0.2;
    ctx.fillStyle   = si % 5 === 0 ? "#c084fc" : "#e2e8f0";
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────
   AURORA – flowing curtains over starfield
───────────────────────────────────────────── */
interface AuroraBand {
  baseY:   number;
  freq:    number;
  amp:     number;
  phase:   number;
  speed:   number;
  height:  number;
  colors:  [string, string];
}

const AURORA_BANDS: AuroraBand[] = [
  { baseY: 0.25, freq: 1.8, amp: 60, phase: 0,    speed: 0.28, height: 140, colors: ["rgba(0,255,180,0.18)", "rgba(0,200,140,0)"] },
  { baseY: 0.30, freq: 2.2, amp: 45, phase: 1.2,  speed: 0.22, height: 110, colors: ["rgba(30,220,255,0.16)", "rgba(0,150,200,0)"] },
  { baseY: 0.22, freq: 1.5, amp: 75, phase: 2.8,  speed: 0.18, height: 160, colors: ["rgba(120,80,255,0.13)", "rgba(80,40,200,0)"] },
  { baseY: 0.28, freq: 2.8, amp: 35, phase: 0.7,  speed: 0.35, height:  90, colors: ["rgba(0,255,140,0.10)", "rgba(0,180,100,0)"] },
  { baseY: 0.20, freq: 1.2, amp: 90, phase: 3.5,  speed: 0.15, height: 120, colors: ["rgba(160,40,255,0.10)", "rgba(100,0,200,0)"] },
];

const AURORA_STARS = Array.from({ length: 260 }, () => ({
  x: Math.random(), y: Math.random(),
  r: Math.random() * 0.7 + 0.15,
  a: Math.random() * 0.5 + 0.1,
  tw: Math.random() * Math.PI * 2,
}));

function drawAurora(ctx: Ctx, W: number, H: number, t: number) {
  ctx.clearRect(0, 0, W, H);

  AURORA_STARS.forEach(s => {
    ctx.globalAlpha = s.a * (0.5 + 0.5 * Math.sin(t + s.tw));
    ctx.fillStyle   = "#e0f0ff";
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H * 0.7, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  AURORA_BANDS.forEach(band => {
    const cy = band.baseY * H;
    const pts: [number, number][] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const px = (i / steps) * W;
      const phase2 = i / steps * Math.PI * 2 * band.freq + t * band.speed + band.phase;
      const py = cy + Math.sin(phase2) * band.amp + Math.cos(phase2 * 0.5 + 1) * band.amp * 0.4;
      pts.push([px, py]);
    }

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(0, pts[0][1]);
    pts.forEach(([px, py]) => ctx.lineTo(px, py));
    [...pts].reverse().forEach(([px, py]) => ctx.lineTo(px, py + band.height));
    ctx.closePath();

    const grd = ctx.createLinearGradient(0, cy - band.amp, 0, cy + band.amp + band.height);
    grd.addColorStop(0,   "rgba(0,0,0,0)");
    grd.addColorStop(0.3, band.colors[0]);
    grd.addColorStop(0.7, band.colors[0]);
    grd.addColorStop(1,   band.colors[1]);
    ctx.fillStyle = grd;
    ctx.fill();
  });

  const groundG = ctx.createLinearGradient(0, H * 0.6, 0, H);
  groundG.addColorStop(0, "rgba(0,40,30,0.4)");
  groundG.addColorStop(1, "rgba(0,15,10,0.7)");
  ctx.fillStyle = groundG; ctx.globalAlpha = 1;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  const treePts = Array.from({ length: 32 }, (_, i) => {
    const tx = (i / 31) * W;
    const seed = Math.sin(i * 1.3) * 0.5 + Math.sin(i * 0.7) * 0.3;
    return { tx, th: 60 + seed * 40 };
  });
  ctx.fillStyle   = "#030f08";
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(0, H);
  treePts.forEach(({ tx, th }) => {
    ctx.lineTo(tx, H * 0.75 - th);
    ctx.lineTo(tx + (W / 31) * 0.5, H * 0.75 - th * 0.4);
  });
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────
   MATRIX RAIN – neon digital rain columns
───────────────────────────────────────────── */
const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF";

interface RainColumn {
  x:      number;
  y:      number;
  speed:  number;
  len:    number;
  chars:  string[];
  timer:  number;
  resetAt: number;
}

function buildRain(W: number, H: number): RainColumn[] {
  const colW = 16;
  const cols = Math.floor(W / colW);
  return Array.from({ length: cols }, (_, i) => ({
    x:      i * colW + colW / 2,
    y:      -Math.random() * H,
    speed:  1.2 + Math.random() * 2.5,
    len:    8  + Math.floor(Math.random() * 18),
    chars:  Array.from({ length: 28 }, () => MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]),
    timer:  0,
    resetAt: H * (0.6 + Math.random() * 0.6),
  }));
}

function drawMatrix(ctx: Ctx, W: number, H: number, t: number, cols: RainColumn[], primary: string) {
  ctx.clearRect(0, 0, W, H);
  ctx.font = "13px 'JetBrains Mono', monospace";

  cols.forEach(col => {
    col.y += col.speed;
    col.timer++;

    if (col.timer % 6 === 0) {
      const idx = Math.floor(Math.random() * col.chars.length);
      col.chars[idx] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
    }

    if (col.y > col.resetAt) {
      col.y      = -Math.random() * H * 0.3;
      col.speed  = 1.2 + Math.random() * 2.5;
      col.len    = 8 + Math.floor(Math.random() * 18);
    }

    const fs = 13;
    for (let j = 0; j < col.len; j++) {
      const cy = col.y - j * fs;
      if (cy < 0 || cy > H) continue;
      const frac   = 1 - j / col.len;
      const isHead = j === 0;
      if (isHead) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle   = "#ffffff";
        ctx.shadowColor = primary;
        ctx.shadowBlur  = 14;
      } else {
        ctx.globalAlpha = frac * 0.75;
        ctx.fillStyle   = primary;
        ctx.shadowColor = primary;
        ctx.shadowBlur  = 4;
      }
      ctx.fillText(col.chars[j % col.chars.length], col.x - 6, cy);
    }
  });

  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────
   MIDNIGHT PURPLE – particle nebula field
───────────────────────────────────────────── */
interface NebParticle { x: number; y: number; vx: number; vy: number; r: number; color: string; alpha: number; }

const NEB_COLS = ["#a855f7","#9333ea","#c084fc","#d8b4fe","#7c3aed","#e879f9","#6d28d9"];

function buildNebula(W: number, H: number): NebParticle[] {
  return Array.from({ length: 180 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.22,
    r:  Math.random() * 2.5 + 0.4,
    color: NEB_COLS[Math.floor(Math.random() * NEB_COLS.length)],
    alpha: Math.random() * 0.35 + 0.08,
  }));
}

function drawNebula(ctx: Ctx, W: number, H: number, t: number, particles: NebParticle[]) {
  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < 3; i++) {
    const ox = W * [0.3, 0.7, 0.5][i];
    const oy = H * [0.35, 0.6, 0.2][i];
    const r  = W * [0.35, 0.28, 0.22][i];
    const g  = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0,   ["rgba(120,30,200,0.12)","rgba(80,0,160,0.10)","rgba(180,50,255,0.08)"][i]);
    g.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
  }

  for (let si = 0; si < 220; si++) {
    const sx = (Math.sin(si * 2.3) * 0.5 + 0.5) * W;
    const sy = (Math.cos(si * 1.8) * 0.5 + 0.5) * H;
    ctx.globalAlpha = 0.18 + Math.sin(t * 0.9 + si) * 0.10;
    ctx.fillStyle = si % 4 === 0 ? "#c4b5fd" : "#e2d9f3";
    ctx.beginPath();
    ctx.arc(sx, sy, si % 7 === 0 ? 0.9 : 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
    if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;

    const pulse = p.alpha * (0.6 + 0.4 * Math.sin(t * 1.2 + p.x * 0.01));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    if (p.r > 1.8) {
      ctx.globalAlpha = pulse * 0.15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────
   BLOOD MOON – crimson atmospheric haze
───────────────────────────────────────────── */
interface BloodStar { x: number; y: number; r: number; tw: number; }

const BLOOD_STARS: BloodStar[] = Array.from({ length: 200 }, () => ({
  x: Math.random(), y: Math.random(),
  r: Math.random() * 0.8 + 0.15,
  tw: Math.random() * Math.PI * 2,
}));

function drawBloodMoon(ctx: Ctx, W: number, H: number, t: number) {
  ctx.clearRect(0, 0, W, H);

  BLOOD_STARS.forEach(s => {
    ctx.globalAlpha = 0.25 + Math.sin(t * 0.8 + s.tw) * 0.15;
    ctx.fillStyle = "#ffcccc";
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const moon = ctx.createRadialGradient(W * 0.72, H * 0.18, 0, W * 0.72, H * 0.18, Math.min(W, H) * 0.13);
  moon.addColorStop(0,   "rgba(255,120,80,0.70)");
  moon.addColorStop(0.4, "rgba(200,40,20,0.50)");
  moon.addColorStop(0.8, "rgba(150,10,10,0.25)");
  moon.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = moon; ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, W, H);

  const atm = ctx.createRadialGradient(W*0.5, 0, 0, W*0.5, 0, H*0.8);
  atm.addColorStop(0,   "rgba(180,10,10,0.16)");
  atm.addColorStop(0.5, "rgba(120,0,0,0.08)");
  atm.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = atm; ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 1;
}

/* ─────────────────────────────────────────────
   NEURAL PULSE – drifting nodes + live connections + energy packets
───────────────────────────────────────────── */
interface NeuralNode {
  x: number; y: number;
  vx: number; vy: number;
  r: number; color: string;
  pulsePhase: number; pulseSpeed: number;
}
interface NeuralPacket {
  fromIdx: number; toIdx: number;
  progress: number; speed: number; color: string;
}
interface NeuralWave {
  x: number; y: number;
  radius: number; maxRadius: number; color: string;
}
interface NeuralState {
  nodes: NeuralNode[]; packets: NeuralPacket[]; waves: NeuralWave[];
}

const NP_COLORS   = ["#00d4ff","#00e5ff","#40c4ff","#00bcd4","#80deea","#4dd0e1","#26c6da","#00acc1"];
const NP_COUNT    = 110;
const NP_THRESH   = 195;

function buildNeuralPulse(W: number, H: number): NeuralState {
  const nodes: NeuralNode[] = Array.from({ length: NP_COUNT }, () => {
    const speed = 0.12 + Math.random() * 0.32;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: 1.3 + Math.random() * 2.0,
      color: NP_COLORS[Math.floor(Math.random() * NP_COLORS.length)],
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.7 + Math.random() * 0.7,
    };
  });
  return { nodes, packets: [], waves: [] };
}

function drawNeuralPulse(ctx: Ctx, W: number, H: number, t: number, state: NeuralState) {
  ctx.clearRect(0, 0, W, H);
  const { nodes, packets, waves } = state;

  // Move nodes
  for (const n of nodes) {
    n.x += n.vx; n.y += n.vy;
    if (n.x < 0) { n.x = 0; n.vx *= -1; }
    if (n.x > W) { n.x = W; n.vx *= -1; }
    if (n.y < 0) { n.y = 0; n.vy *= -1; }
    if (n.y > H) { n.y = H; n.vy *= -1; }
  }

  // Connections
  ctx.save();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < NP_THRESH) {
        const alpha = (1 - dist / NP_THRESH) * 0.5;
        const aHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
        const grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grd.addColorStop(0, a.color + aHex);
        grd.addColorStop(1, b.color + aHex);
        ctx.beginPath();
        ctx.strokeStyle = grd;
        ctx.lineWidth   = (1 - dist / NP_THRESH) * 1.4;
        ctx.globalAlpha = 1;
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Nodes
  for (const n of nodes) {
    const pulse = 0.65 + 0.35 * Math.sin(t * n.pulseSpeed + n.pulsePhase);
    const glowR = n.r * 5;
    const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
    grd.addColorStop(0, n.color + "99");
    grd.addColorStop(1, n.color + "00");
    ctx.globalAlpha = pulse * 0.75;
    ctx.fillStyle   = grd;
    ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = "#ffffff";
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle   = n.color;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Spawn packets
  if (Math.random() < 0.05 && packets.length < 55) {
    const i = Math.floor(Math.random() * nodes.length);
    const j = Math.floor(Math.random() * nodes.length);
    if (i !== j) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < NP_THRESH) {
        packets.push({ fromIdx: i, toIdx: j, progress: 0, speed: 0.010 + Math.random() * 0.016, color: nodes[i].color });
      }
    }
  }

  // Draw packets
  for (let pi = packets.length - 1; pi >= 0; pi--) {
    const p = packets[pi];
    p.progress += p.speed;
    if (p.progress >= 1) { packets.splice(pi, 1); continue; }
    const a = nodes[p.fromIdx], b = nodes[p.toIdx];
    const px = a.x + (b.x - a.x) * p.progress;
    const py = a.y + (b.y - a.y) * p.progress;
    const gAlpha = Math.sin(p.progress * Math.PI);
    const grd = ctx.createRadialGradient(px, py, 0, px, py, 6);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.3, p.color);
    grd.addColorStop(1,   p.color + "00");
    ctx.globalAlpha = gAlpha;
    ctx.fillStyle   = grd;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Spawn pulse waves
  if (Math.random() < 0.009 && waves.length < 10) {
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    waves.push({ x: n.x, y: n.y, radius: 0, maxRadius: 110 + Math.random() * 60, color: n.color });
  }

  // Draw waves
  for (let wi = waves.length - 1; wi >= 0; wi--) {
    const w = waves[wi];
    w.radius += 1.6;
    if (w.radius > w.maxRadius) { waves.splice(wi, 1); continue; }
    const alpha = (1 - w.radius / w.maxRadius) * 0.55;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = w.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* ─────────────────────────────────────────────
   PREMIUM ATMOSPHERE – luxury cosmic glass field
───────────────────────────────────────────── */
interface PremiumStar { x: number; y: number; r: number; tw: number; color: string; drift: number; }
interface PremiumNode { x: number; y: number; vx: number; vy: number; r: number; color: string; phase: number; }
interface PremiumState { stars: PremiumStar[]; nodes: PremiumNode[]; }

const PREMIUM_STAR_COLORS = ["#ffffff", "#9eefff", "#7edbff", "#d6b8ff", "#ff8f5a", "#ffd37a", "#ff7bda"];
const PREMIUM_NODE_COLORS = ["#00dcff", "#4e7dff", "#c13dff", "#ff42ca", "#ff7440", "#ffd05a"];

function buildPremiumAtmosphere(W: number, H: number): PremiumState {
  return {
    stars: Array.from({ length: 260 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.15 + 0.18,
      tw: Math.random() * Math.PI * 2,
      color: PREMIUM_STAR_COLORS[Math.floor(Math.random() * PREMIUM_STAR_COLORS.length)],
      drift: 0.03 + Math.random() * 0.12,
    })),
    nodes: Array.from({ length: 58 }, () => {
      const speed = 0.05 + Math.random() * 0.12;
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.4 + Math.random() * 2.2,
        color: PREMIUM_NODE_COLORS[Math.floor(Math.random() * PREMIUM_NODE_COLORS.length)],
        phase: Math.random() * Math.PI * 2,
      };
    }),
  };
}

function drawPremiumAtmosphere(ctx: Ctx, W: number, H: number, t: number, state: PremiumState) {
  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#020615");
  bg.addColorStop(0.45, "#05051a");
  bg.addColorStop(1, "#12050f");
  ctx.fillStyle = bg;
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, W, H);

  const nebula = [
    { x: W * 0.16, y: H * 0.18, r: W * 0.36, c: "rgba(0,120,255,0.09)" },
    { x: W * 0.82, y: H * 0.26, r: W * 0.30, c: "rgba(255,82,36,0.07)" },
    { x: W * 0.48, y: H * 0.70, r: W * 0.34, c: "rgba(255,0,190,0.05)" },
    { x: W * 0.62, y: H * 0.18, r: W * 0.22, c: "rgba(46,80,255,0.06)" },
  ];

  nebula.forEach((n, i) => {
    const ox = Math.sin(t * (0.12 + i * 0.03) + i) * 28;
    const oy = Math.cos(t * (0.10 + i * 0.04) + i) * 18;
    const g = ctx.createRadialGradient(n.x + ox, n.y + oy, 0, n.x + ox, n.y + oy, n.r);
    g.addColorStop(0, n.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });

  state.stars.forEach((s) => {
    s.y += s.drift;
    if (s.y > H + 4) {
      s.y = -4;
      s.x = Math.random() * W;
    }
    const pulse = 0.24 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.tw));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.r > 0.9 ? 9 : 4;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.shadowBlur = 0;

  for (let i = 0; i < state.nodes.length; i++) {
    const a = state.nodes[i];
    a.x += a.vx;
    a.y += a.vy;
    if (a.x < 0 || a.x > W) a.vx *= -1;
    if (a.y < 0 || a.y > H) a.vy *= -1;

    for (let j = i + 1; j < state.nodes.length; j++) {
      const b = state.nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 180) {
        const alpha = (1 - d / 180) * 0.20;
        const grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grd.addColorStop(0, `rgba(0,220,255,${alpha})`);
        grd.addColorStop(0.5, `rgba(255,0,200,${alpha * 0.72})`);
        grd.addColorStop(1, `rgba(255,124,50,${alpha * 0.8})`);
        ctx.strokeStyle = grd;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    const glow = 0.35 + 0.35 * Math.sin(t * 1.4 + a.phase);
    ctx.globalAlpha = 0.55 + glow * 0.35;
    ctx.fillStyle = a.color;
    ctx.shadowColor = a.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r + glow, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  const vignette = ctx.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.72, "rgba(0,0,0,0.26)");
  vignette.addColorStop(1, "rgba(0,0,0,0.68)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const ANIMATED_THEMES = new Set([
  "starfield","galaxy","synthwave","aurora","neon-cyberpunk","midnight-purple","blood-moon","neural-pulse","premium-atmosphere",
]);

export function AnimatedBackground() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const timeRef   = useRef(0);

  const dataRef   = useRef<{
    starLayers?:  ReturnType<typeof buildStarLayers>;
    shooters?:    Shooter[];
    galaxyArms?:  GalaxyDot[];
    rain?:        RainColumn[];
    nebula?:      NebParticle[];
    neural?:      NeuralState;
    premium?:     PremiumState;
  }>({});

  const active = ANIMATED_THEMES.has(theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!active) {
      canvas.style.opacity = "0";
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.style.opacity = "1";

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const W = canvas.width, H = canvas.height;

      if (theme === "starfield") {
        dataRef.current.starLayers = buildStarLayers(W, H);
        dataRef.current.shooters   = [];
      }
      if (theme === "galaxy") {
        dataRef.current.galaxyArms = buildGalaxyArms(1800);
      }
      if (theme === "neon-cyberpunk") {
        dataRef.current.rain = buildRain(W, H);
      }
      if (theme === "midnight-purple") {
        dataRef.current.nebula = buildNebula(W, H);
      }
      if (theme === "neural-pulse") {
        dataRef.current.neural = buildNeuralPulse(W, H);
      }
      if (theme === "premium-atmosphere") {
        dataRef.current.premium = buildPremiumAtmosphere(W, H);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    timeRef.current = 0;

    const shooterTimer = { v: 0 };
    let paused = isBackgroundPaused() || (typeof document !== "undefined" && document.hidden);

    const stopLoop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
    const startLoop = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(draw);
    };

    const handleVisibility = () => {
      const shouldPause = isBackgroundPaused() || document.hidden;
      if (shouldPause === paused) return;
      paused = shouldPause;
      if (paused) stopLoop();
      else startLoop();
    };
    const offBgPause = onBackgroundPauseChange((p) => {
      const shouldPause = p || (typeof document !== "undefined" && document.hidden);
      if (shouldPause === paused) return;
      paused = shouldPause;
      if (paused) stopLoop();
      else startLoop();
    });
    document.addEventListener("visibilitychange", handleVisibility);

    const draw = () => {
      if (paused) {
        rafRef.current = 0;
        return;
      }
      timeRef.current += 0.016;
      const t  = timeRef.current;
      const W  = canvas.width;
      const H  = canvas.height;

      if (theme === "starfield") {
        const { starLayers, shooters } = dataRef.current;
        if (!starLayers || !shooters) return;
        shooterTimer.v++;
        if (shooterTimer.v > 120 + Math.random() * 200) {
          shooterTimer.v = 0;
          const angle   = -Math.PI / 6 + (Math.random() - 0.5) * Math.PI / 4;
          const speed   = 10 + Math.random() * 8;
          shooters.push({
            x: Math.random() * W * 0.7, y: Math.random() * H * 0.4,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            len: 10 + Math.random() * 8,
            life: 40 + Math.random() * 20,
            maxLife: 60,
            r: 1 + Math.random(),
          });
        }
        drawStarfield(ctx, W, H, t, starLayers, shooters);
      }
      else if (theme === "galaxy") {
        if (!dataRef.current.galaxyArms) return;
        drawGalaxy(ctx, W, H, t, dataRef.current.galaxyArms);
      }
      else if (theme === "synthwave") {
        drawSynthwave(ctx, W, H, t);
      }
      else if (theme === "aurora") {
        drawAurora(ctx, W, H, t);
      }
      else if (theme === "neon-cyberpunk") {
        if (!dataRef.current.rain) return;
        drawMatrix(ctx, W, H, t, dataRef.current.rain, "#00ff9f");
      }
      else if (theme === "midnight-purple") {
        if (!dataRef.current.nebula) return;
        drawNebula(ctx, W, H, t, dataRef.current.nebula);
      }
      else if (theme === "blood-moon") {
        drawBloodMoon(ctx, W, H, t);
      }
      else if (theme === "neural-pulse") {
        if (!dataRef.current.neural) return;
        drawNeuralPulse(ctx, W, H, t, dataRef.current.neural);
      }
      else if (theme === "premium-atmosphere") {
        if (!dataRef.current.premium) return;
        drawPremiumAtmosphere(ctx, W, H, t, dataRef.current.premium);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    if (!paused) draw();

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      offBgPause();
      cancelAnimationFrame(rafRef.current);
    };
  }, [theme, active]);

  return (
    <canvas
      id="animated-bg-canvas"
      ref={canvasRef}
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        width:         "100%",
        height:        "100%",
        pointerEvents: "none",
        zIndex:        -1,
        opacity:       active ? 1 : 0,
        transition:    "opacity 0.6s ease",
      }}
    />
  );
}
