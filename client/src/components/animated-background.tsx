import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

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
   MAIN COMPONENT
───────────────────────────────────────────── */
const ANIMATED_THEMES = new Set([
  "starfield","galaxy","synthwave","aurora","neon-cyberpunk","midnight-purple","blood-moon",
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
    };

    resize();
    window.addEventListener("resize", resize);
    timeRef.current = 0;

    const shooterTimer = { v: 0 };

    const draw = () => {
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

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
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
