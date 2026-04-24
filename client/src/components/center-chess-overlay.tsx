import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Crown, Flag, Maximize2, Minimize2, Minus, Palette, RotateCcw, Trophy, X,
  Eye, EyeOff, Timer, Monitor,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import type { ChessRoomState } from "@/components/chess-panel";

interface Props {
  socket: Socket | null;
  roomId: string;
  userId: string;
  forceOpen?: boolean;
  onClose?: () => void;
  onGameEnded?: (info: { winner: "white" | "black" | "draw"; whiteName: string; blackName: string; reason: string }) => void;
}

const POS_KEY_PREFIX = "c2t-chess-overlay-pos:";
const THEME_KEY = "c2t-chess-overlay-theme";

type BoardTheme = { id: string; name: string; light: string; dark: string; highlight: string; check: string };

const BOARD_THEMES: BoardTheme[] = [
  { id: "classic",  name: "Classic Green", light: "#eeeed2", dark: "#769656", highlight: "rgba(255,235,59,0.55)",  check: "rgba(255,80,80,0.55)"  },
  { id: "ocean",    name: "Ocean Blue",    light: "#dee3e6", dark: "#8ca2ad", highlight: "rgba(100,200,255,0.55)", check: "rgba(255,80,80,0.55)"  },
  { id: "walnut",   name: "Walnut Wood",   light: "#f0d9b5", dark: "#b58863", highlight: "rgba(255,200,80,0.55)",  check: "rgba(255,80,80,0.6)"   },
  { id: "midnight", name: "Midnight",      light: "#9aa3b8", dark: "#3b3f54", highlight: "rgba(180,140,255,0.6)", check: "rgba(255,90,90,0.6)"   },
];

function formatClock(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CenterChessOverlay({ socket, roomId, userId, forceOpen, onClose, onGameEnded }: Props) {
  const [state, setState] = useState<ChessRoomState | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [followColor, setFollowColor] = useState<"white" | "black" | null>(null);
  const [winnerBanner, setWinnerBanner] = useState<{ name: string; reason: string } | null>(null);
  const [themeId, setThemeId] = useState<string>(() => {
    if (typeof window === "undefined") return "classic";
    try { return localStorage.getItem(THEME_KEY) || "classic"; } catch { return "classic"; }
  });
  const [themeOpen, setThemeOpen] = useState(false);
  const theme = useMemo(() => BOARD_THEMES.find(t => t.id === themeId) || BOARD_THEMES[0], [themeId]);
  useEffect(() => { try { localStorage.setItem(THEME_KEY, themeId); } catch {} }, [themeId]);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try { const raw = localStorage.getItem(POS_KEY_PREFIX + roomId); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const chessRef = useRef<Chess>(new Chess());

  // Live clocks
  const [liveClocks, setLiveClocks] = useState<{ white: number; black: number } | null>(null);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    if (!state?.clocks || state.status !== "playing") {
      setLiveClocks(state?.clocks ? { white: state.clocks.white, black: state.clocks.black } : null);
      return;
    }
    const tick = () => {
      setLiveClocks(() => {
        if (!state?.clocks || state.status !== "playing") return null;
        const elapsed = Date.now() - state.clocks.lastTickAt;
        const active = state.turn === "w" ? "white" : "black";
        return {
          white: active === "white" ? Math.max(0, state.clocks.white - elapsed) : state.clocks.white,
          black: active === "black" ? Math.max(0, state.clocks.black - elapsed) : state.clocks.black,
        };
      });
    };
    tick();
    clockIntervalRef.current = setInterval(tick, 200);
    return () => { if (clockIntervalRef.current) clearInterval(clockIntervalRef.current); };
  }, [state]);

  useEffect(() => {
    if (!socket) return;
    const onState = (s: ChessRoomState | null) => {
      setState(s);
      try { chessRef.current = new Chess(s?.fen || undefined); } catch { chessRef.current = new Chess(); }
      const prev = lastStatusRef.current;
      lastStatusRef.current = s?.status || null;
      if (s && s.status === "ended" && prev !== "ended") {
        let name = "Draw";
        if (s.winner === "white") name = s.white?.username || "White";
        else if (s.winner === "black") name = s.black?.username || "Black";
        setWinnerBanner({ name, reason: s.endReason || "game over" });
        setTimeout(() => setWinnerBanner(null), 8000);
        onGameEnded?.({
          winner: (s.winner as any) || "draw",
          whiteName: s.white?.username || "White",
          blackName: s.black?.username || "Black",
          reason: s.endReason || "game over",
        });
      }
      if (s && s.status === "playing") setMinimized(false);
    };
    socket.on("room:chess-state", onState);
    socket.emit("room:chess-sync-request", { roomId });
    return () => { socket.off("room:chess-state", onState); };
  }, [socket, roomId]);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    const last = state?.lastMove;
    if (last?.from) styles[last.from] = { background: theme.highlight, boxShadow: `inset 0 0 0 3px ${theme.highlight}` };
    if (last?.to)   styles[last.to]   = { background: theme.highlight, boxShadow: `inset 0 0 0 3px ${theme.highlight}` };
    try {
      const g = chessRef.current;
      if (g.inCheck()) {
        const turn = g.turn();
        const board = g.board();
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const sq = board[r][c];
            if (sq && sq.type === "k" && sq.color === turn) {
              const file = "abcdefgh"[c];
              const rank = 8 - r;
              styles[`${file}${rank}`] = { background: theme.check, boxShadow: `inset 0 0 0 4px ${theme.check}` };
            }
          }
        }
      }
    } catch {}
    return styles;
  }, [state?.lastMove, state?.fen, theme]);

  const myColor: "white" | "black" | null = useMemo(() => {
    if (state?.white?.userId === userId) return "white";
    if (state?.black?.userId === userId) return "black";
    return null;
  }, [state, userId]);

  const isMyTurn = state?.status === "playing" &&
    ((myColor === "white" && state.turn === "w") || (myColor === "black" && state.turn === "b"));

  // Board orientation: player sees their color at bottom; spectator can follow a player
  const boardOrientation: "white" | "black" = useMemo(() => {
    if (myColor) return myColor;
    if (followColor) return followColor;
    return "white";
  }, [myColor, followColor]);

  const onPieceDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (!state || state.status !== "playing" || !isMyTurn || !socket) return false;
    const game = new Chess(state.fen);
    let move;
    try { move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" }); } catch { return false; }
    if (!move) return false;
    let status: "playing" | "ended" = "playing";
    let winner: "white" | "black" | "draw" | null = null;
    let endReason: string | null = null;
    if (game.isCheckmate()) { status = "ended"; winner = game.turn() === "w" ? "black" : "white"; endReason = "checkmate"; }
    else if (game.isStalemate()) { status = "ended"; winner = "draw"; endReason = "stalemate"; }
    else if (game.isDraw() || game.isInsufficientMaterial() || game.isThreefoldRepetition()) { status = "ended"; winner = "draw"; endReason = "draw"; }
    socket.emit("room:chess-move", {
      roomId, fen: game.fen(), pgn: game.pgn(), turn: game.turn(),
      lastMove: { from: sourceSquare, to: targetSquare, san: move.san },
      status, winner, endReason,
    });
    return true;
  };

  const resign = () => { if (!confirm("Resign this game?")) return; socket?.emit("room:chess-resign", { roomId }); };
  const newGame = () => socket?.emit("room:chess-new-game", { roomId });
  const rematch = () => socket?.emit("room:chess-rematch", { roomId });

  const onPointerDown = (e: React.PointerEvent) => {
    if (fullscreen) return; // no dragging in fullscreen
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, baseX: rect.left, baseY: rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const x = Math.max(8, Math.min(window.innerWidth - 200, dragRef.current.baseX + dx));
    const y = Math.max(8, Math.min(window.innerHeight - 100, dragRef.current.baseY + dy));
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (pos) { try { localStorage.setItem(POS_KEY_PREFIX + roomId, JSON.stringify(pos)); } catch {} }
  };

  const isSeatedPlayer = myColor !== null;
  const gameLive = !!state && (state.status === "playing" || state.status === "ended");
  const showOverlay = gameLive && (isSeatedPlayer || !!forceOpen);

  // Compute board size based on fullscreen state
  const boardWidth = useMemo(() => {
    if (fullscreen) {
      const side = Math.min(window.innerWidth, window.innerHeight) - 180;
      return Math.max(280, side);
    }
    return Math.min(360, Math.max(260, window.innerWidth - 100));
  }, [fullscreen]);

  const ClockPill = ({ side }: { side: "white" | "black" }) => {
    if (!liveClocks || !state?.timeControl) return null;
    const ms = liveClocks[side];
    const isActive = state.turn === (side === "white" ? "w" : "b") && state.status === "playing";
    const low = ms < 30000;
    return (
      <span
        className={`font-mono font-bold text-sm tabular-nums px-2 py-1 rounded-lg transition-colors ${
          isActive
            ? low ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-amber-400 text-black shadow-lg shadow-amber-400/20"
            : "bg-zinc-800 text-zinc-400"
        }`}
        data-testid={`clock-${side}`}
      >
        <Timer className="w-3 h-3 inline mr-1 opacity-70" />
        {formatClock(ms)}
      </span>
    );
  };

  return (
    <>
      {/* Winner banner */}
      {winnerBanner && (
        <div className="fixed inset-x-0 top-6 z-[200] flex justify-center pointer-events-none" data-testid="banner-chess-winner">
          <div
            className="pointer-events-auto rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(255,200,80,0.96) 0%, rgba(255,140,40,0.94) 100%)",
              border: "2px solid rgba(255,255,255,0.45)",
              boxShadow: "0 12px 40px rgba(255,140,0,0.5), 0 0 0 4px rgba(255,200,80,0.18)",
            }}
          >
            <Trophy className="w-7 h-7 text-white drop-shadow" />
            <div className="text-white">
              <div className="text-xs uppercase tracking-widest opacity-90">Chess Result</div>
              <div className="text-lg font-bold leading-tight">
                {winnerBanner.name === "Draw" ? "It's a draw!" : `${winnerBanner.name} wins!`}
                <span className="ml-2 text-sm font-medium opacity-90">by {winnerBanner.reason}</span>
              </div>
            </div>
            <button onClick={() => setWinnerBanner(null)} className="ml-3 rounded-full p-1 text-white/90 hover:bg-white/20" data-testid="button-close-winner-banner">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Center floating chess board */}
      {showOverlay && (
        <div
          ref={wrapperRef}
          className={fullscreen ? "fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" : "fixed z-[55] select-none"}
          style={!fullscreen ? (pos
            ? { left: pos.x, top: pos.y }
            : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }) : undefined}
          data-testid="overlay-center-chess"
        >
          <div
            className={`rounded-2xl overflow-hidden shadow-2xl ${fullscreen ? "w-auto" : ""}`}
            style={{
              background: "linear-gradient(135deg, rgba(20,18,15,0.98) 0%, rgba(35,30,25,0.98) 100%)",
              border: "1.5px solid rgba(255,200,120,0.30)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 30px rgba(255,180,80,0.20)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Drag / control header */}
            <div
              className={`flex items-center justify-between px-3 py-2 ${fullscreen ? "cursor-default" : "cursor-move"} touch-none`}
              style={{ background: "linear-gradient(90deg, rgba(255,180,80,0.18) 0%, rgba(255,140,60,0.12) 100%)" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              data-testid="chess-overlay-drag-handle"
            >
              <div className="flex items-center gap-2 text-amber-200 font-semibold text-xs min-w-0">
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Chess · {state?.status === "playing"
                    ? (isMyTurn ? "Your move" : `${(state.turn === "w" ? state.white?.username : state.black?.username) || "Player"} to move`)
                    : "Game ended"}
                  {state?.lastMove?.san && (
                    <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200/15 border border-amber-200/25 text-amber-100">
                      last: {state.lastMove.san}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Spectator follow toggle */}
                {!isSeatedPlayer && state?.status === "playing" && (
                  <div className="flex items-center gap-0.5 mr-1" onPointerDown={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFollowColor(followColor === "white" ? null : "white"); }}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${followColor === "white" ? "bg-white text-black" : "bg-amber-200/10 text-amber-200/70 hover:bg-amber-200/20"}`}
                      title="Follow White's view"
                      data-testid="button-follow-white"
                    >
                      {followColor === "white" ? <Eye className="w-3 h-3" /> : "⬜"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFollowColor(followColor === "black" ? null : "black"); }}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${followColor === "black" ? "bg-zinc-800 text-white border border-white/20" : "bg-amber-200/10 text-amber-200/70 hover:bg-amber-200/20"}`}
                      title="Follow Black's view"
                      data-testid="button-follow-black"
                    >
                      {followColor === "black" ? <Eye className="w-3 h-3" /> : "⬛"}
                    </button>
                  </div>
                )}
                {/* Theme picker */}
                <button
                  onClick={(e) => { e.stopPropagation(); setThemeOpen(o => !o); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                  data-testid="button-chess-theme" title="Board theme"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                {/* Fullscreen toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); setFullscreen(f => !f); if (minimized) setMinimized(false); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                  data-testid="button-chess-fullscreen"
                  title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                {/* Minimize (only in windowed mode) */}
                {!fullscreen && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMinimized(m => !m); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                    data-testid="button-chess-minimize"
                    title={minimized ? "Expand" : "Minimize"}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                )}
                {!isSeatedPlayer && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose?.(); setFullscreen(false); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                    data-testid="button-chess-close-spectator" title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {isSeatedPlayer && state?.status === "ended" && (
                  <button
                    onClick={() => { newGame(); setFullscreen(false); }}
                    className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                    data-testid="button-chess-close" title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!minimized && (
              <div className={`p-3 ${fullscreen ? "flex flex-col items-center" : ""}`}>
                {/* Follow mode indicator for spectators */}
                {!isSeatedPlayer && followColor && (
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] text-amber-200/70 bg-amber-200/8 rounded px-2 py-1">
                    <Eye className="w-3 h-3" />
                    Following {followColor === "white" ? state?.white?.username || "White" : state?.black?.username || "Black"}'s view
                    <button onClick={() => setFollowColor(null)} className="ml-auto text-amber-200/50 hover:text-amber-200">
                      <EyeOff className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Black player + clock */}
                <div className={`flex items-center gap-2 mb-2 px-1 ${fullscreen ? "w-full" : ""}`} data-testid="chess-overlay-black">
                  <Avatar className="w-7 h-7">
                    {state?.black?.avatar ? <AvatarImage src={state.black.avatar} /> : null}
                    <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-200">{state?.black?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">Black</span>
                    <span className="text-sm font-semibold text-zinc-200">{state?.black?.username || "—"}</span>
                  </div>
                  {state?.status === "playing" && state.turn === "b" && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40">to move</span>
                  )}
                  <div className="ml-auto">
                    <ClockPill side="black" />
                  </div>
                </div>

                {/* Board */}
                <div className="relative rounded-lg overflow-hidden border border-amber-200/20" style={{ background: theme.dark }}>
                  <Chessboard
                    position={state?.fen || "start"}
                    onPieceDrop={onPieceDrop}
                    boardOrientation={boardOrientation}
                    arePiecesDraggable={!!isMyTurn}
                    customBoardStyle={{ borderRadius: "0px" }}
                    customLightSquareStyle={{ backgroundColor: theme.light }}
                    customDarkSquareStyle={{ backgroundColor: theme.dark }}
                    customSquareStyles={customSquareStyles}
                    boardWidth={boardWidth}
                  />
                  {/* Theme picker dropdown */}
                  {themeOpen && (
                    <div
                      className="absolute top-2 right-2 z-10 rounded-lg p-2 shadow-2xl"
                      style={{ background: "rgba(20,18,15,0.96)", border: "1px solid rgba(255,200,120,0.35)", backdropFilter: "blur(8px)" }}
                      data-testid="chess-theme-picker"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-amber-200/70 mb-1.5 px-1">Board Theme</div>
                      <div className="flex flex-col gap-1">
                        {BOARD_THEMES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => { setThemeId(t.id); setThemeOpen(false); }}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 hover:bg-amber-200/10 ${themeId === t.id ? "bg-amber-200/15" : ""}`}
                            data-testid={`button-theme-${t.id}`}
                          >
                            <div className="flex w-7 h-5 rounded overflow-hidden border border-white/15">
                              <div style={{ flex: 1, background: t.light }} />
                              <div style={{ flex: 1, background: t.dark }} />
                            </div>
                            <span className="text-xs text-amber-100">{t.name}</span>
                            {themeId === t.id && <span className="ml-auto text-[10px] text-amber-300">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fullscreen hint */}
                  {fullscreen && !isSeatedPlayer && !followColor && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur rounded-full px-3 py-1 text-[10px] text-white/60 pointer-events-none">
                      Click ⬜/⬛ in the header to follow a player's view
                    </div>
                  )}
                </div>

                {/* White player + clock */}
                <div className={`flex items-center gap-2 mt-2 px-1 ${fullscreen ? "w-full" : ""}`} data-testid="chess-overlay-white">
                  <Avatar className="w-7 h-7">
                    {state?.white?.avatar ? <AvatarImage src={state.white.avatar} /> : null}
                    <AvatarFallback className="text-[10px] bg-zinc-100 text-zinc-800">{state?.white?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">White</span>
                    <span className="text-sm font-semibold text-zinc-200">{state?.white?.username || "—"}</span>
                  </div>
                  {state?.status === "playing" && state.turn === "w" && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40">to move</span>
                  )}
                  <div className="ml-auto">
                    <ClockPill side="white" />
                  </div>
                </div>

                {/* Game over result */}
                {state?.status === "ended" && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-center text-sm font-semibold text-amber-100"
                    style={{ background: "linear-gradient(90deg, rgba(255,180,80,0.18) 0%, rgba(255,140,40,0.14) 100%)", border: "1px solid rgba(255,200,120,0.30)" }}>
                    <Trophy className="w-4 h-4 inline mr-1 text-amber-300" />
                    {state.winner === "draw"
                      ? `Draw — ${state.endReason}`
                      : `${state.winner === "white" ? state.white?.username : state.black?.username} wins by ${state.endReason}`}
                  </div>
                )}

                {/* Action buttons */}
                <div className={`mt-3 flex gap-2 ${fullscreen ? "w-full max-w-sm" : ""}`}>
                  {myColor && state?.status === "playing" && (
                    <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={resign} data-testid="button-overlay-resign">
                      <Flag className="w-3.5 h-3.5 mr-1" /> Resign
                    </Button>
                  )}
                  {state?.status === "ended" && (
                    <>
                      {(state.white?.userId === userId || state.black?.userId === userId) && (
                        <Button size="sm" variant="default" className="flex-1 h-8 text-xs bg-amber-500/90 hover:bg-amber-500 text-black" onClick={rematch} data-testid="button-overlay-rematch">
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Rematch
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-amber-200/40 text-amber-100 hover:bg-amber-200/10" onClick={newGame} data-testid="button-overlay-new-game">
                        <X className="w-3 h-3 mr-1" /> End
                      </Button>
                    </>
                  )}
                </div>

                {!fullscreen && (
                  <p className="mt-2 text-[10px] text-center text-zinc-500">
                    Drag header to move · <button className="text-amber-300/60 hover:text-amber-300 underline underline-offset-2" onClick={() => setFullscreen(true)}>Fullscreen</button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ChessPlayerBadge() {
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full"
      style={{
        background: "linear-gradient(135deg, rgba(255,200,80,0.95) 0%, rgba(255,140,40,0.95) 100%)",
        boxShadow: "0 0 6px rgba(255,180,60,0.6)",
        border: "1.5px solid rgba(255,255,255,0.6)",
      }}
      title="Playing chess"
      data-testid="badge-chess-player"
    >
      <Crown className="w-2.5 h-2.5 text-white" />
    </span>
  );
}
