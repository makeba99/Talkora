import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Crown, Flag, Minus, RotateCcw, Trophy, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import type { ChessRoomState } from "@/components/chess-panel";

interface Props {
  socket: Socket | null;
  roomId: string;
  userId: string;
}

const POS_KEY_PREFIX = "c2t-chess-overlay-pos:";

export function CenterChessOverlay({ socket, roomId, userId }: Props) {
  const [state, setState] = useState<ChessRoomState | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [winnerBanner, setWinnerBanner] = useState<{ name: string; reason: string } | null>(null);
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
      }
      if (s && s.status === "playing") setMinimized(false);
    };
    socket.on("room:chess-state", onState);
    socket.emit("room:chess-sync-request", { roomId });
    return () => { socket.off("room:chess-state", onState); };
  }, [socket, roomId]);

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

  // Show overlay only while a game is in progress or just ended
  const showOverlay = !!state && (state.status === "playing" || state.status === "ended");

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
              <div className="flex items-center gap-2 text-amber-200 font-semibold text-xs">
                <Crown className="w-3.5 h-3.5" />
                Chess · {state?.status === "playing" ? (isMyTurn ? "Your move" : `${state.turn === "w" ? state.white?.username : state.black?.username || "Player"} to move`) : "Game ended"}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(m => !m)}
                  className="rounded p-1 text-amber-200/80 hover:bg-amber-200/10"
                  data-testid="button-chess-minimize"
                  title={minimized ? "Expand" : "Minimize"}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                {state?.status === "ended" && (
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

                <div className="rounded-lg overflow-hidden border border-amber-200/20 bg-[#312e2b]">
                  <Chessboard
                    position={state?.fen || "start"}
                    onPieceDrop={onPieceDrop}
                    boardOrientation={myColor === "black" ? "black" : "white"}
                    arePiecesDraggable={!!isMyTurn}
                    customBoardStyle={{ borderRadius: "0px" }}
                    boardWidth={Math.min(360, Math.max(260, window.innerWidth - 100))}
                  />
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
