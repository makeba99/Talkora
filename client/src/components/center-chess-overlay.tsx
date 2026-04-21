import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Crown, Flag, Minus, Palette, RotateCcw, Trophy, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import type { ChessRoomState } from "@/components/chess-panel";

interface Props {
  socket: Socket | null;
  roomId: string;
  userId: string;
  /** Externally controlled visibility for spectators (e.g. opened by clicking a player). */
  forceOpen?: boolean;
  /** Called when the user closes the overlay (so the parent can clear forceOpen). */
  onClose?: () => void;
  /** Called once when the game transitions into "ended" — used by the parent to announce the winner in room chat. */
  onGameEnded?: (info: { winner: "white" | "black" | "draw"; whiteName: string; blackName: string; reason: string }) => void;
}

const POS_KEY_PREFIX = "c2t-chess-overlay-pos:";
const THEME_KEY = "c2t-chess-overlay-theme";

type BoardTheme = {
  id: string;
  name: string;
  light: string;
  dark: string;
  highlight: string; // last move highlight color
  check: string;
};

const BOARD_THEMES: BoardTheme[] = [
  { id: "classic", name: "Classic Green", light: "#eeeed2", dark: "#769656", highlight: "rgba(255, 235, 59, 0.55)", check: "rgba(255, 80, 80, 0.55)" },
  { id: "ocean",   name: "Ocean Blue",    light: "#dee3e6", dark: "#8ca2ad", highlight: "rgba(100, 200, 255, 0.55)", check: "rgba(255, 80, 80, 0.55)" },
  { id: "walnut",  name: "Walnut Wood",   light: "#f0d9b5", dark: "#b58863", highlight: "rgba(255, 200, 80, 0.55)", check: "rgba(255, 80, 80, 0.6)" },
  { id: "midnight",name: "Midnight",      light: "#9aa3b8", dark: "#3b3f54", highlight: "rgba(180, 140, 255, 0.6)", check: "rgba(255, 90, 90, 0.6)" },
];

export function CenterChessOverlay({ socket, roomId, userId, forceOpen, onClose, onGameEnded }: Props) {
  const [state, setState] = useState<ChessRoomState | null>(null);
  const [minimized, setMinimized] = useState(false);
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
    try {
      const raw = localStorage.getItem(POS_KEY_PREFIX + roomId);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const chessRef = useRef<Chess>(new Chess());

  useEffect(() => {
    if (!socket) return;
    const onState = (s: ChessRoomState | null) => {
      setState(s);
      try { chessRef.current = new Chess(s?.fen || undefined); } catch { chessRef.current = new Chess(); }

      // Detect transition into ended → broadcast banner globally
      const prev = lastStatusRef.current;
      lastStatusRef.current = s?.status || null;
      if (s && s.status === "ended" && prev !== "ended") {
        let name = "Draw";
        if (s.winner === "white") name = s.white?.username || "White";
        else if (s.winner === "black") name = s.black?.username || "Black";
        else name = "Draw";
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

  // Compute square highlights for last-move + king-in-check
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
      roomId,
      fen: game.fen(),
      pgn: game.pgn(),
      turn: game.turn(),
      lastMove: { from: sourceSquare, to: targetSquare, san: move.san },
      status, winner, endReason,
    });
    return true;
  };

  const resign = () => {
    if (!confirm("Resign this game?")) return;
    socket?.emit("room:chess-resign", { roomId });
  };
  const newGame = () => socket?.emit("room:chess-new-game", { roomId });
  const closeGame = () => socket?.emit("room:chess-new-game", { roomId });

  // Drag handling on header
  const onPointerDown = (e: React.PointerEvent) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    dragRef.current = {
      active: true, startX: e.clientX, startY: e.clientY,
      baseX: rect.left, baseY: rect.top,
    };
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
    if (pos) {
      try { localStorage.setItem(POS_KEY_PREFIX + roomId, JSON.stringify(pos)); } catch {}
    }
  };

  // Show overlay automatically only for the seated players. Spectators only see
  // the board when they explicitly open it (parent passes forceOpen=true, e.g. by
  // clicking on a player who is currently in a game).
  const isSeatedPlayer = myColor !== null;
  const gameLive = !!state && (state.status === "playing" || state.status === "ended");
  const showOverlay = gameLive && (isSeatedPlayer || !!forceOpen);

  return (
    <>
      {/* Winner banner — shown to everyone in the room for ~8s */}
      {winnerBanner && (
        <div
          className="fixed inset-x-0 top-6 z-[200] flex justify-center pointer-events-none"
          data-testid="banner-chess-winner"
        >
          <div
            className="pointer-events-auto rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(255,200,80,0.96) 0%, rgba(255,140,40,0.94) 100%)",
              border: "2px solid rgba(255,255,255,0.45)",
              boxShadow: "0 12px 40px rgba(255,140,0,0.5), 0 0 0 4px rgba(255,200,80,0.18)",
              animation: "pulse 1.4s ease-in-out infinite alternate",
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
            <button
              onClick={() => setWinnerBanner(null)}
              className="ml-3 rounded-full p-1 text-white/90 hover:bg-white/20"
              data-testid="button-close-winner-banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Center floating chess board (draggable, minimizable) */}
      {showOverlay && (
        <div
          ref={wrapperRef}
          className="fixed z-[55] select-none"
          style={pos
            ? { left: pos.x, top: pos.y }
            : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          data-testid="overlay-center-chess"
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(20,18,15,0.96) 0%, rgba(35,30,25,0.96) 100%)",
              border: "1.5px solid rgba(255,200,120,0.30)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 30px rgba(255,180,80,0.20)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Drag header */}
            <div
              className="flex items-center justify-between px-3 py-2 cursor-move touch-none"
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
                <button
                  onClick={(e) => { e.stopPropagation(); setThemeOpen(o => !o); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                  data-testid="button-chess-theme"
                  title="Board theme"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMinimized(m => !m); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                  data-testid="button-chess-minimize"
                  title={minimized ? "Expand" : "Minimize"}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                {/* Spectators get a close button so they can dismiss after opening from a profile click */}
                {!isSeatedPlayer && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                    data-testid="button-chess-close-spectator"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {isSeatedPlayer && state?.status === "ended" && (
                  <button
                    onClick={closeGame}
                    className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                    data-testid="button-chess-close"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!minimized && (
              <div className="p-3">
                {/* Black player on top */}
                <div className="flex items-center gap-2 mb-2 px-1" data-testid="chess-overlay-black">
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
                </div>

                <div className="relative rounded-lg overflow-hidden border border-amber-200/20" style={{ background: theme.dark }}>
                  <Chessboard
                    position={state?.fen || "start"}
                    onPieceDrop={onPieceDrop}
                    boardOrientation={myColor === "black" ? "black" : "white"}
                    arePiecesDraggable={!!isMyTurn}
                    customBoardStyle={{ borderRadius: "0px" }}
                    customLightSquareStyle={{ backgroundColor: theme.light }}
                    customDarkSquareStyle={{ backgroundColor: theme.dark }}
                    customSquareStyles={customSquareStyles}
                    boardWidth={Math.min(360, Math.max(260, window.innerWidth - 100))}
                  />
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
                </div>

                {/* White player on bottom */}
                <div className="flex items-center gap-2 mt-2 px-1" data-testid="chess-overlay-white">
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
                </div>

                {state?.status === "ended" && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-center text-sm font-semibold text-amber-100"
                    style={{ background: "linear-gradient(90deg, rgba(255,180,80,0.18) 0%, rgba(255,140,40,0.14) 100%)", border: "1px solid rgba(255,200,120,0.30)" }}>
                    <Trophy className="w-4 h-4 inline mr-1 text-amber-300" />
                    {state.winner === "draw"
                      ? `Draw — ${state.endReason}`
                      : `${state.winner === "white" ? state.white?.username : state.black?.username} wins by ${state.endReason}`}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {myColor && state?.status === "playing" && (
                    <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={resign} data-testid="button-overlay-resign">
                      <Flag className="w-3.5 h-3.5 mr-1" /> Resign
                    </Button>
                  )}
                  {state?.status === "ended" && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-amber-200/40 text-amber-100 hover:bg-amber-200/10" onClick={newGame} data-testid="button-overlay-new-game">
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> New Game
                    </Button>
                  )}
                </div>

                <p className="mt-2 text-[10px] text-center text-zinc-500">Drag the header to move · Minimize anytime</p>
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
