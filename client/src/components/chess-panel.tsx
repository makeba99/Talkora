import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink, Flag, Crown, RotateCcw, X, Link as LinkIcon, Trophy, Users,
  Swords, Check, Timer, Hash, RefreshCw, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type ChessSeat = { userId: string; username: string; avatar?: string | null } | null;

export interface ChessParticipant {
  id: string;
  displayName?: string | null;
  firstName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
}

interface IncomingChallenge {
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string | null;
  color: "white" | "black" | "random";
  challengeId: string;
  timeControl?: number | null;
}

interface IncomingTttChallenge {
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string | null;
  roomId: string;
}

type TttSeat = { userId: string; username: string; avatar?: string | null } | null;
type TttState = {
  board: (null | "X" | "O")[];
  turn: "X" | "O";
  status: "active" | "ended";
  winner: "X" | "O" | "draw" | null;
  winLine: number[] | null;
  x: TttSeat;
  o: TttSeat;
  scores: { x: number; o: number; draws: number };
  startedAt: number;
};

export interface ChessRoomState {
  fen: string;
  pgn: string;
  white: ChessSeat;
  black: ChessSeat;
  turn: "w" | "b";
  status: "waiting" | "playing" | "ended";
  winner?: "white" | "black" | "draw" | null;
  endReason?: string | null;
  startedAt: number;
  lastMove?: { from: string; to: string; san: string } | null;
  timeControl?: number | null;
  clocks?: { white: number; black: number; lastTickAt: number } | null;
  mode?: "standard" | "timed" | null;
}

export interface LichessShare {
  url: string;
  sharedBy: string;
}


const TIME_OPTIONS = [
  { label: "Untimed", value: null },
  { label: "1 min", value: 60000 },
  { label: "3 min", value: 180000 },
  { label: "5 min", value: 300000 },
  { label: "10 min", value: 600000 },
];

function formatClock(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  socket: Socket | null;
  roomId: string;
  userId: string;
  participants: ChessParticipant[];
}

function nameOf(p: ChessParticipant) {
  return p.displayName || p.firstName || (p.email ? p.email.split("@")[0] : null) || "Player";
}

function extractLichessUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\/(www\.)?lichess\.org\//i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z0-9]{8,12}$/.test(trimmed)) return `https://lichess.org/${trimmed}`;
  return null;
}

function lichessEmbedUrl(rawUrl: string): string {
  const u = rawUrl.replace(/^https?:\/\/(www\.)?lichess\.org\//i, "");
  const gameId = u.split(/[/?#]/)[0]?.slice(0, 8);
  if (!gameId) return rawUrl;
  return `https://lichess.org/embed/game/${gameId}?theme=auto&bg=auto`;
}

export function ChessPanel({ socket, roomId, userId, participants }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"quick" | "lichess" | "tictactoe">("quick");
  const [state, setState] = useState<ChessRoomState | null>(null);
  const [lichess, setLichess] = useState<LichessShare | null>(null);
  const [lichessInput, setLichessInput] = useState("");
  const [lichessError, setLichessError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [pendingTo, setPendingTo] = useState<{ userId: string; username: string } | null>(null);
  const [showChallengeList, setShowChallengeList] = useState(false);
  const [selectedTimeControl, setSelectedTimeControl] = useState<number | null>(null);
  const [showTimeOptions, setShowTimeOptions] = useState(false);

  // Tic-Tac-Toe state
  const [tttState, setTttState] = useState<TttState | null>(null);
  const [incomingTtt, setIncomingTtt] = useState<IncomingTttChallenge | null>(null);
  const [pendingTttTo, setPendingTttTo] = useState<{ userId: string; username: string } | null>(null);
  const [showTttChallengeList, setShowTttChallengeList] = useState(false);

  // Live clocks
  const [liveClocks, setLiveClocks] = useState<{ white: number; black: number } | null>(null);
  const clockInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const chessRef = useRef<Chess>(new Chess());
  const boardWrapperRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<number>(320);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);

  useEffect(() => {
    const el = boardWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setBoardSize(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Live clock countdown
  useEffect(() => {
    if (clockInterval.current) clearInterval(clockInterval.current);
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
    clockInterval.current = setInterval(tick, 200);
    return () => { if (clockInterval.current) clearInterval(clockInterval.current); };
  }, [state]);

  // Sync from server
  useEffect(() => {
    if (!socket) return;
    const onState = (s: ChessRoomState | null) => {
      setState(s);
      try { chessRef.current = new Chess(s?.fen || undefined); } catch { chessRef.current = new Chess(); }
    };
    const onLichess = (l: LichessShare | null) => setLichess(l);
    const onChallenge = (c: IncomingChallenge) => setIncoming(c);
    const onDeclined = (d: { byUserId: string; byUsername: string }) => {
      if (pendingTo?.userId === d.byUserId) setPendingTo(null);
      toast({ title: "Challenge declined", description: `${d.byUsername} declined your chess challenge.` });
    };
    const onAccepted = () => {
      setPendingTo(null);
      setShowChallengeList(false);
      toast({ title: "Challenge accepted!", description: "Game starting now." });
    };
    const onTttChallenge = (c: IncomingTttChallenge) => setIncomingTtt(c);
    const onTttState = (s: TttState | null) => setTttState(s);
    const onTttDeclined = (d: { byUserId: string; byUsername: string }) => {
      if (pendingTttTo?.userId === d.byUserId) setPendingTttTo(null);
      toast({ title: "Tic-Tac-Toe declined", description: `${d.byUsername} declined.` });
    };
    const onTttAccepted = () => {
      setPendingTttTo(null);
      setShowTttChallengeList(false);
      setTab("tictactoe");
      toast({ title: "Match starting!", description: "Tic-Tac-Toe is on." });
    };
    socket.on("room:chess-state", onState);
    socket.on("room:lichess", onLichess);
    socket.on("room:chess-challenge", onChallenge);
    socket.on("room:chess-challenge-declined", onDeclined);
    socket.on("room:chess-challenge-accepted", onAccepted);
    socket.on("room:ttt-challenge", onTttChallenge);
    socket.on("room:ttt-state", onTttState);
    socket.on("room:ttt-declined", onTttDeclined);
    socket.on("room:ttt-accepted", onTttAccepted);
    socket.emit("room:chess-sync-request", { roomId });
    socket.emit("room:ttt-sync", { roomId });
    return () => {
      socket.off("room:chess-state", onState);
      socket.off("room:lichess", onLichess);
      socket.off("room:chess-challenge", onChallenge);
      socket.off("room:chess-challenge-declined", onDeclined);
      socket.off("room:chess-challenge-accepted", onAccepted);
      socket.off("room:ttt-challenge", onTttChallenge);
      socket.off("room:ttt-state", onTttState);
      socket.off("room:ttt-declined", onTttDeclined);
      socket.off("room:ttt-accepted", onTttAccepted);
    };
  }, [socket, roomId, pendingTo?.userId, pendingTttTo?.userId, toast]);

  const sendChallenge = (target: ChessParticipant) => {
    if (!socket) return;
    socket.emit("room:chess-challenge", { roomId, targetUserId: target.id, color: "random", timeControl: selectedTimeControl });
    setPendingTo({ userId: target.id, username: nameOf(target) });
    toast({ title: "Challenge sent", description: `Waiting for ${nameOf(target)} to respond…` });
    setTimeout(() => setPendingTo((p) => (p?.userId === target.id ? null : p)), 30000);
  };

  const respondChallenge = (accept: boolean) => {
    if (!incoming || !socket) return;
    socket.emit("room:chess-challenge-respond", {
      roomId,
      fromUserId: incoming.fromUserId,
      accept,
      color: incoming.color,
      timeControl: incoming.timeControl ?? null,
    });
    setIncoming(null);
    if (accept) { setShowChallengeList(false); setTab("quick"); }
  };

  const sendTttChallenge = (target: ChessParticipant) => {
    if (!socket) return;
    socket.emit("room:ttt-challenge", { roomId, targetUserId: target.id });
    setPendingTttTo({ userId: target.id, username: nameOf(target) });
    toast({ title: "Tic-Tac-Toe sent!", description: `Waiting for ${nameOf(target)}…` });
    setTimeout(() => setPendingTttTo((p) => (p?.userId === target.id ? null : p)), 30000);
  };

  const respondTttChallenge = (accept: boolean) => {
    if (!incomingTtt || !socket) return;
    socket.emit("room:ttt-respond", { roomId, fromUserId: incomingTtt.fromUserId, accept });
    setIncomingTtt(null);
    if (accept) setTab("tictactoe");
  };

  const tttPlayCell = (idx: number) => {
    if (!socket || !tttState || tttState.status !== "active") return;
    const mySym: "X" | "O" | null = tttState.x?.userId === userId ? "X" : tttState.o?.userId === userId ? "O" : null;
    if (!mySym || tttState.turn !== mySym) return;
    if (tttState.board[idx] !== null) return;
    socket.emit("room:ttt-move", { roomId, idx });
  };
  const tttRematch = () => socket?.emit("room:ttt-rematch", { roomId });
  const tttClose = () => socket?.emit("room:ttt-close", { roomId });

  const myColor: "white" | "black" | null = useMemo(() => {
    if (state?.white?.userId === userId) return "white";
    if (state?.black?.userId === userId) return "black";
    return null;
  }, [state, userId]);

  const isMyTurn = state?.status === "playing" &&
    ((myColor === "white" && state.turn === "w") || (myColor === "black" && state.turn === "b"));

  const claimSeat = (color: "white" | "black") =>
    socket?.emit("room:chess-claim-seat", { roomId, color, timeControl: selectedTimeControl });
  const leaveSeat = () => socket?.emit("room:chess-leave-seat", { roomId });
  const resign = () => { if (!confirm("Resign this game?")) return; socket?.emit("room:chess-resign", { roomId }); };
  const newGame = () => socket?.emit("room:chess-new-game", { roomId });
  const rematch = () => socket?.emit("room:chess-rematch", { roomId });

  const submitMove = (sourceSquare: string, targetSquare: string): boolean => {
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
    setSelectedSquare(null);
    setLegalTargets([]);
    return true;
  };

  const onPieceDrop = (src: string, tgt: string): boolean => submitMove(src, tgt);

  const onSquareClick = (square: string) => {
    if (!state || state.status !== "playing" || !isMyTurn) return;
    const game = new Chess(state.fen);
    const piece = game.get(square as any);
    if (selectedSquare && selectedSquare !== square) {
      const moved = submitMove(selectedSquare, square);
      if (moved) return;
    }
    if (piece && piece.color === state.turn) {
      setSelectedSquare(square);
      try {
        const moves = game.moves({ square: square as any, verbose: true }) as any[];
        setLegalTargets(moves.map((m) => m.to));
      } catch { setLegalTargets([]); }
    } else {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  const highlightSquares = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) styles[selectedSquare] = { background: "rgba(255,217,0,0.45)" };
    for (const t of legalTargets) {
      styles[t] = { background: "radial-gradient(circle, rgba(20,180,80,0.55) 22%, transparent 24%)" };
    }
    return styles;
  }, [selectedSquare, legalTargets]);

  const shareLichess = () => {
    setLichessError(null);
    const url = extractLichessUrl(lichessInput);
    if (!url) { setLichessError("Paste a Lichess game URL or game ID"); return; }
    socket?.emit("room:lichess", { roomId, url });
    setLichessInput("");
  };
  const clearLichess = () => socket?.emit("room:lichess", { roomId, url: null });

  const selectedTimeLabel = TIME_OPTIONS.find(o => o.value === selectedTimeControl)?.label || "Untimed";

  const seatBadge = (seat: ChessSeat, color: "white" | "black") => {
    const isOpen = !seat;
    const isMine = seat?.userId === userId;
    const isActive = state?.turn === (color === "white" ? "w" : "b") && state?.status === "playing";
    return (
      <div
        className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${isActive ? "border-primary/60 bg-primary/5" : "border-border/50 bg-muted/20"}`}
        data-testid={`chess-seat-${color}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded ${color === "white" ? "bg-white" : "bg-black border border-white/30"} flex items-center justify-center`}>
            <Crown className={`w-3.5 h-3.5 ${color === "white" ? "text-black" : "text-white"}`} />
          </div>
          {seat ? (
            <>
              <Avatar className="w-6 h-6">
                {seat.avatar ? <AvatarImage src={seat.avatar} alt="" /> : null}
                <AvatarFallback className="text-[10px]">{seat.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium truncate" data-testid={`text-chess-${color}-name`}>{seat.username}</span>
            </>
          ) : <span className="text-xs text-muted-foreground">Open seat</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {liveClocks && state?.status === "playing" && (
            <span className={`text-xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${
              isActive ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
            } ${liveClocks[color] < 30000 && isActive ? "text-red-400" : ""}`}>
              {formatClock(liveClocks[color])}
            </span>
          )}
          {isOpen && state?.status !== "ended" && !myColor && (
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => claimSeat(color)} data-testid={`button-claim-${color}`}>Sit</Button>
          )}
          {isMine && state?.status !== "playing" && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={leaveSeat} data-testid={`button-leave-${color}`}>Leave</Button>
          )}
        </div>
      </div>
    );
  };

  const statusLine = () => {
    if (!state) return "No game yet — claim a seat to start";
    if (state.status === "waiting") {
      if (state.white && !state.black) return "Waiting for Black…";
      if (!state.white && state.black) return "Waiting for White…";
      return "Open seats — click Sit to play";
    }
    if (state.status === "playing") {
      const turnName = state.turn === "w" ? state.white?.username : state.black?.username;
      return isMyTurn ? "Your move" : `${turnName || (state.turn === "w" ? "White" : "Black")} to move`;
    }
    if (state.winner === "draw") return `Draw — ${state.endReason}`;
    const winnerName = state.winner === "white" ? state.white?.username : state.black?.username;
    return `${winnerName || state.winner} wins by ${state.endReason}`;
  };

  // ---------- Tic-Tac-Toe helpers ----------
  const myTttSym: "X" | "O" | null = useMemo(() => {
    if (tttState?.x?.userId === userId) return "X";
    if (tttState?.o?.userId === userId) return "O";
    return null;
  }, [tttState, userId]);
  const isMyTttTurn = !!tttState && tttState.status === "active" && !!myTttSym && tttState.turn === myTttSym;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Tabs */}
      <div className="p-3 pb-2 border-b flex-shrink-0 flex items-center gap-1.5">
        <button
          onClick={() => setTab("quick")}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${tab === "quick" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
          data-testid="tab-chess-quick"
        >
          <Users className="w-3 h-3 inline mr-1" /> Match
        </button>
        <button
          onClick={() => setTab("tictactoe")}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${tab === "tictactoe" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
          data-testid="tab-tictactoe"
        >
          <Hash className="w-3 h-3 inline mr-1" /> Tic-Tac-Toe
        </button>
        <button
          onClick={() => setTab("lichess")}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${tab === "lichess" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
          data-testid="tab-chess-lichess"
        >
          <ExternalLink className="w-3 h-3 inline mr-1" /> Lichess
        </button>
      </div>

      {/* ─── Quick Match ─── */}
      {tab === "quick" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          {seatBadge(state?.white ?? null, "white")}
          <div ref={boardWrapperRef} className="rounded-lg overflow-hidden border border-border/60 bg-[#312e2b] w-full">
            <Chessboard
              position={state?.fen || "start"}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              boardOrientation={myColor === "black" ? "black" : "white"}
              arePiecesDraggable={!!isMyTurn}
              customBoardStyle={{ borderRadius: "0px" }}
              customSquareStyles={highlightSquares}
              boardWidth={boardSize}
            />
          </div>
          {seatBadge(state?.black ?? null, "black")}

          {state?.timeControl && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Timer className="w-3 h-3" />
              <span>{TIME_OPTIONS.find(o => o.value === state.timeControl)?.label || "Timed"} · Blitz</span>
            </div>
          )}

          <div className="text-center text-xs font-medium py-1" data-testid="text-chess-status">
            {state?.status === "ended" && <Trophy className="w-3.5 h-3.5 inline mr-1 text-amber-500" />}
            {statusLine()}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {myColor && state?.status === "playing" && (
              <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={resign} data-testid="button-chess-resign">
                <Flag className="w-3.5 h-3.5 mr-1" /> Resign
              </Button>
            )}
            {state?.status === "ended" && (
              <>
                {(state.white?.userId === userId || state.black?.userId === userId) && (
                  <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={rematch} data-testid="button-chess-rematch">
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rematch
                  </Button>
                )}
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={newGame} data-testid="button-chess-new-game">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> New Game
                </Button>
              </>
            )}
            {(!state || state.status !== "playing") && !myColor && (
              <Button
                size="sm" variant="default" className="flex-1 h-8 text-xs"
                onClick={() => setShowChallengeList((s) => !s)}
                data-testid="button-chess-challenge-toggle"
              >
                <Swords className="w-3.5 h-3.5 mr-1" /> Challenge
              </Button>
            )}
          </div>

          {/* Time control picker */}
          {(!state || state.status !== "playing") && (
            <div className="relative">
              <button
                onClick={() => setShowTimeOptions(o => !o)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 text-xs text-muted-foreground transition-colors"
                data-testid="button-time-control-picker"
              >
                <span className="flex items-center gap-1.5">
                  <Timer className="w-3 h-3" /> Time control: <strong className="text-foreground">{selectedTimeLabel}</strong>
                </span>
                {showTimeOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showTimeOptions && (
                <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-lg border border-border/60 bg-background shadow-xl">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => { setSelectedTimeControl(opt.value); setShowTimeOptions(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/40 flex items-center justify-between ${selectedTimeControl === opt.value ? "text-primary font-semibold" : "text-foreground"}`}
                      data-testid={`button-tc-${opt.label.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      {opt.label}
                      {selectedTimeControl === opt.value && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {pendingTo && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300 flex items-center justify-between" data-testid="text-pending-challenge">
              <span>Waiting for {pendingTo.username}…</span>
              <button onClick={() => setPendingTo(null)} className="text-amber-300/70 hover:text-amber-200" data-testid="button-cancel-pending">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {showChallengeList && (!state || state.status !== "playing") && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-2 space-y-1.5" data-testid="list-challenge-targets">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Players in this room</p>
              {participants.filter((p) => p.id !== userId).length === 0 ? (
                <p className="text-[11px] text-muted-foreground p-2 text-center">No one else is here yet — invite a friend!</p>
              ) : (
                participants.filter((p) => p.id !== userId).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/40" data-testid={`row-challenge-${p.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-7 h-7">
                        {p.profileImageUrl ? <AvatarImage src={p.profileImageUrl} alt="" /> : null}
                        <AvatarFallback className="text-[10px]">{nameOf(p)[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate">{nameOf(p)}</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" disabled={!!pendingTo}
                      onClick={() => sendChallenge(p)} data-testid={`button-challenge-${p.id}`}>
                      <Swords className="w-3 h-3 mr-1" /> Challenge
                    </Button>
                  </div>
                ))
              )}
              <p className="text-[10px] text-muted-foreground/70 px-1 pt-1">Colors assigned randomly. Game starts on acceptance.</p>
            </div>
          )}

          {!myColor && state?.status === "playing" && (
            <Badge variant="secondary" className="w-full justify-center text-[10px] py-1">Spectating live</Badge>
          )}
        </div>
      )}

      {/* ─── Tic-Tac-Toe ─── */}
      {tab === "tictactoe" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2" data-testid="panel-tictactoe">
          {!tttState && (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold">Tic-Tac-Toe</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Quick 3-in-a-row match against another person in this room. Challenger plays X, opponent plays O. First to align three wins the round.
                </p>
              </div>

              <Button
                size="sm" variant="default" className="w-full h-8 text-xs"
                onClick={() => setShowTttChallengeList((o) => !o)}
                data-testid="button-ttt-challenge-list"
              >
                <Swords className="w-3.5 h-3.5 mr-1" /> Challenge to Tic-Tac-Toe
              </Button>

              {pendingTttTo && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300 flex items-center justify-between">
                  <span>Waiting for {pendingTttTo.username}…</span>
                  <button onClick={() => setPendingTttTo(null)}><X className="w-3 h-3" /></button>
                </div>
              )}

              {showTttChallengeList && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-2 space-y-1.5" data-testid="list-ttt-targets">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Players in this room</p>
                  {participants.filter((p) => p.id !== userId).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground p-2 text-center">No one else here yet!</p>
                  ) : (
                    participants.filter((p) => p.id !== userId).map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/40">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            {p.profileImageUrl ? <AvatarImage src={p.profileImageUrl} alt="" /> : null}
                            <AvatarFallback className="text-[10px]">{nameOf(p)[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{nameOf(p)}</span>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" disabled={!!pendingTttTo}
                          onClick={() => sendTttChallenge(p)} data-testid={`button-ttt-challenge-${p.id}`}>
                          <Hash className="w-3 h-3 mr-1" /> Play
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          {tttState && (
            <div className="space-y-2" data-testid="ttt-board-wrapper">
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                <div className="text-center min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                    X · {tttState.x?.username || "—"}
                  </p>
                  <p className={`text-2xl font-bold tabular-nums ${myTttSym === "X" ? "text-primary" : "text-foreground"}`}>
                    {tttState.scores.x}
                  </p>
                </div>
                <div className="text-center px-2">
                  <p className="text-[10px] text-muted-foreground">Draws</p>
                  <p className="text-base font-semibold tabular-nums text-muted-foreground">{tttState.scores.draws}</p>
                </div>
                <div className="text-center min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                    O · {tttState.o?.username || "—"}
                  </p>
                  <p className={`text-2xl font-bold tabular-nums ${myTttSym === "O" ? "text-primary" : "text-foreground"}`}>
                    {tttState.scores.o}
                  </p>
                </div>
              </div>

              <div className="text-center text-xs font-medium py-1">
                {tttState.status === "ended"
                  ? tttState.winner === "draw"
                    ? "Round drawn"
                    : `${tttState.winner === "X" ? tttState.x?.username : tttState.o?.username} wins the round!`
                  : isMyTttTurn
                  ? "Your turn"
                  : `${tttState.turn === "X" ? tttState.x?.username : tttState.o?.username || tttState.turn}'s turn`}
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-lg p-1.5 bg-muted/20 border border-border/50 mx-auto" style={{ maxWidth: 320 }}>
                {tttState.board.map((cell, idx) => {
                  const isWinCell = !!tttState.winLine?.includes(idx);
                  const playable = !cell && tttState.status === "active" && isMyTttTurn;
                  return (
                    <button
                      key={idx}
                      onClick={() => tttPlayCell(idx)}
                      disabled={!playable}
                      data-testid={`ttt-cell-${idx}`}
                      className={`aspect-square rounded-md flex items-center justify-center text-3xl font-bold select-none transition-colors ${
                        isWinCell ? "bg-emerald-500/30 border-2 border-emerald-400/70 text-emerald-300" : "bg-muted/40 border border-border/60 hover:bg-muted/60"
                      } ${!playable ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <span className={cell === "X" ? "text-sky-300" : cell === "O" ? "text-amber-300" : "opacity-0"}>
                        {cell || "·"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                {tttState.status === "ended" && (myTttSym !== null) && (
                  <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={tttRematch} data-testid="button-ttt-rematch">
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Next round
                  </Button>
                )}
                {(myTttSym !== null) && (
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={tttClose} data-testid="button-ttt-close">
                    <X className="w-3.5 h-3.5 mr-1" /> End match
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Lichess ─── */}
      {tab === "lichess" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {!lichess ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-semibold">Share a Lichess game</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Open Lichess, start or join a game, then paste the game URL here so everyone in the room can watch live.
                </p>
                <a href="https://lichess.org/login" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline" data-testid="link-lichess-login">
                  Open lichess.org <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="space-y-2">
                <Input value={lichessInput} onChange={(e) => setLichessInput(e.target.value)}
                  placeholder="https://lichess.org/abcd1234" className="h-8 text-xs" data-testid="input-lichess-url" />
                {lichessError && <p className="text-[11px] text-destructive">{lichessError}</p>}
                <Button size="sm" className="w-full h-8 text-xs" onClick={shareLichess} data-testid="button-share-lichess">
                  <LinkIcon className="w-3.5 h-3.5 mr-1" /> Share with room
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden border border-border/60 bg-black aspect-square">
                <iframe src={lichessEmbedUrl(lichess.url)} className="w-full h-full border-0" loading="lazy" allow="fullscreen" data-testid="iframe-lichess" />
              </div>
              <div className="flex gap-2">
                <a href={lichess.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open on Lichess
                  </Button>
                </a>
                {lichess.sharedBy === userId && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearLichess} data-testid="button-clear-lichess">
                    <X className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Incoming chess challenge dialog */}
      <Dialog open={!!incoming} onOpenChange={(o) => { if (!o) respondChallenge(false); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-incoming-challenge">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" /> Chess challenge
            </DialogTitle>
            <DialogDescription>
              {incoming && (
                <span className="flex flex-col gap-2 mt-2">
                  <span className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      {incoming.fromAvatar ? <AvatarImage src={incoming.fromAvatar} alt="" /> : null}
                      <AvatarFallback>{incoming.fromUsername?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>
                      <strong className="text-foreground">{incoming.fromUsername}</strong> wants to play chess with you
                    </span>
                  </span>
                  {incoming.timeControl && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2 py-1 w-fit">
                      <Timer className="w-3 h-3" />
                      {TIME_OPTIONS.find(o => o.value === incoming.timeControl)?.label || "Timed"} per side
                    </span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => respondChallenge(false)} data-testid="button-decline-challenge">
              <X className="w-3.5 h-3.5 mr-1" /> Decline
            </Button>
            <Button className="flex-1" onClick={() => respondChallenge(true)} data-testid="button-accept-challenge">
              <Check className="w-3.5 h-3.5 mr-1" /> Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incoming Tic-Tac-Toe dialog */}
      <Dialog open={!!incomingTtt} onOpenChange={(o) => { if (!o) respondTttChallenge(false); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-incoming-ttt">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" /> Tic-Tac-Toe Challenge!
            </DialogTitle>
            <DialogDescription asChild>
              {incomingTtt ? (
                <span className="flex items-center gap-2 mt-2">
                  <Avatar className="w-8 h-8">
                    {incomingTtt.fromAvatar ? <AvatarImage src={incomingTtt.fromAvatar} alt="" /> : null}
                    <AvatarFallback>{incomingTtt.fromUsername?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>
                    <strong className="text-foreground">{incomingTtt.fromUsername}</strong> wants to play Tic-Tac-Toe with you!
                  </span>
                </span>
              ) : <span />}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => respondTttChallenge(false)} data-testid="button-decline-ttt">Decline</Button>
            <Button className="flex-1" onClick={() => respondTttChallenge(true)} data-testid="button-accept-ttt">
              <Hash className="w-3.5 h-3.5 mr-1" /> Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
