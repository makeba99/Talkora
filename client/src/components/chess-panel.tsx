import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink, Flag, Crown, RotateCcw, X, Trophy, Users,
  Swords, Check, Timer, RefreshCw, Zap, ChevronDown, ChevronUp, Circle, Maximize2, Gamepad2,
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

type C4Seat = { userId: string; username: string; avatar: string | null } | null;
type C4State = {
  board: (null | "red" | "yellow")[][];
  turn: "red" | "yellow";
  status: "playing" | "ended";
  winner: "red" | "yellow" | "draw" | null;
  winLine: [number, number][] | null;
  red: C4Seat;
  yellow: C4Seat;
  scores: { red: number; yellow: number; draws: number };
  startedAt: number;
};
type IncomingC4Challenge = {
  fromUserId: string;
  fromUsername: string;
  fromAvatar: string | null;
  roomId: string;
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
  onOpenC4Board?: () => void;
}

function nameOf(p: ChessParticipant) {
  return p.displayName || p.firstName || (p.email ? p.email.split("@")[0] : null) || "Player";
}

export function ChessPanel({ socket, roomId, userId, participants, onOpenC4Board }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"quick" | "jklm" | "c4">("quick");
  const [state, setState] = useState<ChessRoomState | null>(null);
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [pendingTo, setPendingTo] = useState<{ userId: string; username: string } | null>(null);
  const [showChallengeList, setShowChallengeList] = useState(false);
  const [selectedTimeControl, setSelectedTimeControl] = useState<number | null>(null);
  const [showTimeOptions, setShowTimeOptions] = useState(false);

  // JKLM.fun state
  const [jklmState, setJklmState] = useState<{ url: string; sharedBy: string; sharedByName: string } | null>(null);
  const [incomingJklm, setIncomingJklm] = useState<{ fromUserId: string; fromUsername: string; fromAvatar?: string | null; url: string } | null>(null);
  const [jklmInput, setJklmInput] = useState("");
  const [jklmError, setJklmError] = useState<string | null>(null);
  const [showJklmChallengeList, setShowJklmChallengeList] = useState(false);
  const [jklmSelected, setJklmSelected] = useState<string[]>([]);

  // Connect Four state
  const [c4State, setC4State] = useState<C4State | null>(null);
  const [incomingC4, setIncomingC4] = useState<IncomingC4Challenge | null>(null);
  const [pendingC4To, setPendingC4To] = useState<{ userId: string; username: string } | null>(null);
  const [showC4ChallengeList, setShowC4ChallengeList] = useState(false);

  // Live clocks
  const [liveClocks, setLiveClocks] = useState<{ white: number; black: number } | null>(null);
  const clockInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const chessRef = useRef<Chess>(new Chess());
  const boardWrapperRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<number>(360);
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
      setSelectedSquare(null);
      setLegalTargets([]);
    };
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
    const onC4State = (s: C4State | null) => setC4State(s);
    const onC4Challenge = (c: IncomingC4Challenge) => setIncomingC4(c);
    const onC4Declined = (d: { byUserId: string; byUsername: string }) => {
      if (pendingC4To?.userId === d.byUserId) setPendingC4To(null);
      toast({ title: "Connect Four declined", description: `${d.byUsername} declined.` });
    };
    const onC4Accepted = (_d: { byUserId: string; byUsername: string }) => {
      setPendingC4To(null);
      setShowC4ChallengeList(false);
      setTab("c4");
      toast({ title: "Connect Four accepted!", description: "Game starting — open the board!" });
      onOpenC4Board?.();
    };
    const onJklmState = (s: { url: string; sharedBy: string; sharedByName: string } | null) => setJklmState(s);
    const onJklmInvite = (c: { fromUserId: string; fromUsername: string; fromAvatar?: string | null; url: string }) => {
      setIncomingJklm(c);
      setTab("jklm");
    };
    socket.on("room:chess-state", onState);
    socket.on("room:chess-challenge", onChallenge);
    socket.on("room:chess-challenge-declined", onDeclined);
    socket.on("room:chess-challenge-accepted", onAccepted);
    socket.on("room:c4-state", onC4State);
    socket.on("room:c4-challenge", onC4Challenge);
    socket.on("room:c4-declined", onC4Declined);
    socket.on("room:c4-accepted", onC4Accepted);
    socket.on("room:jklm-state", onJklmState);
    socket.on("room:jklm-invite", onJklmInvite);
    socket.emit("room:chess-sync-request", { roomId });
    socket.emit("room:c4-sync", { roomId });
    socket.emit("room:jklm-sync", { roomId });
    return () => {
      socket.off("room:chess-state", onState);
      socket.off("room:chess-challenge", onChallenge);
      socket.off("room:chess-challenge-declined", onDeclined);
      socket.off("room:chess-challenge-accepted", onAccepted);
      socket.off("room:c4-state", onC4State);
      socket.off("room:c4-challenge", onC4Challenge);
      socket.off("room:c4-declined", onC4Declined);
      socket.off("room:c4-accepted", onC4Accepted);
      socket.off("room:jklm-state", onJklmState);
      socket.off("room:jklm-invite", onJklmInvite);
    };
  }, [socket, roomId, pendingTo?.userId, pendingC4To?.userId, onOpenC4Board, toast]);

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

  const sendC4Challenge = (target: ChessParticipant) => {
    if (!socket) return;
    socket.emit("room:c4-challenge", { roomId, targetUserId: target.id });
    setPendingC4To({ userId: target.id, username: nameOf(target) });
    setShowC4ChallengeList(false);
    toast({ title: "Connect Four sent!", description: `Waiting for ${nameOf(target)}…` });
    setTimeout(() => setPendingC4To((p) => (p?.userId === target.id ? null : p)), 30000);
  };
  const respondC4 = (accept: boolean) => {
    if (!incomingC4 || !socket) return;
    socket.emit("room:c4-respond", { roomId, fromUserId: incomingC4.fromUserId, accept });
    setIncomingC4(null);
    if (accept) { setTab("c4"); onOpenC4Board?.(); }
  };

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

    // If a square is already selected, try to move there first
    if (selectedSquare && selectedSquare !== square) {
      const moved = submitMove(selectedSquare, square);
      if (moved) return;
      // Move failed — if clicking own piece, switch selection instead of deselecting
      if (piece && piece.color === state.turn) {
        setSelectedSquare(square);
        try {
          const moves = game.moves({ square: square as any, verbose: true }) as any[];
          setLegalTargets(moves.map((m) => m.to));
        } catch { setLegalTargets([]); }
        return;
      }
      // Clicked empty/opponent square that's not a legal target — deselect
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }

    // Select the piece if it belongs to the current player
    if (piece && piece.color === state.turn) {
      // Clicking the already-selected square deselects it
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalTargets([]);
        return;
      }
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

    // Last move highlight (light tint)
    const last = state?.lastMove;
    if (last?.from) styles[last.from] = { background: "rgba(255,235,59,0.38)" };
    if (last?.to)   styles[last.to]   = { background: "rgba(255,235,59,0.38)" };

    // Selected square — bright yellow ring + fill
    if (selectedSquare) {
      styles[selectedSquare] = {
        background: "rgba(255,217,0,0.55)",
        boxShadow: "inset 0 0 0 3px rgba(255,217,0,0.90)",
      };
    }

    // Legal move targets — larger dots for empty squares, ring for captures
    for (const t of legalTargets) {
      const hasPiece = (() => { try { return !!chessRef.current.get(t as any); } catch { return false; } })();
      if (hasPiece) {
        // Capture: ring around the square so the piece is still visible
        styles[t] = {
          background: "radial-gradient(circle, transparent 55%, rgba(20,190,80,0.70) 57%, rgba(20,190,80,0.70) 76%, transparent 78%)",
          boxShadow: "inset 0 0 0 2px rgba(20,190,80,0.55)",
        };
      } else {
        // Empty square: large filled dot (~32% of square width)
        styles[t] = {
          background: "radial-gradient(circle, rgba(20,190,80,0.72) 30%, transparent 32%)",
        };
      }
    }

    // Check — king square flashes red
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
              styles[`${file}${rank}`] = {
                background: "rgba(220,50,50,0.60)",
                boxShadow: "inset 0 0 0 4px rgba(220,50,50,0.80)",
              };
            }
          }
        }
      }
    } catch {}

    return styles;
  }, [selectedSquare, legalTargets, state?.lastMove, state?.fen]);

  const shareJklm = () => {
    const code = jklmInput.trim();
    if (!code) { setJklmError("Enter a JKLM room code or full URL"); return; }
    setJklmError(null);
    socket?.emit("room:jklm-share", { roomId, url: code });
    if (jklmSelected.length > 0) {
      socket?.emit("room:jklm-challenge", { roomId, targetUserIds: jklmSelected, url: code });
    }
    setJklmInput("");
    setJklmSelected([]);
    setShowJklmChallengeList(false);
  };
  const clearJklm = () => socket?.emit("room:jklm-clear", { roomId });

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
          onClick={() => setTab("jklm")}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors relative ${tab === "jklm" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
          data-testid="tab-jklm"
        >
          <Gamepad2 className="w-3 h-3 inline mr-1" /> JKLM
          {(jklmState || incomingJklm) && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-violet-400" />}
        </button>
        <button
          onClick={() => setTab("c4")}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors relative ${tab === "c4" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}
          data-testid="tab-c4"
        >
          <Circle className="w-3 h-3 inline mr-1" /> Connect 4
          {c4State?.status === "playing" && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
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
              <button onClick={() => setPendingTo(null)} className="text-amber-300/70 hover:text-amber-200" data-testid="button-cancel-pending" aria-label="Cancel challenge request">
                <X className="w-3 h-3" aria-hidden="true" />
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

      {/* ─── JKLM.fun ─── */}
      {tab === "jklm" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2" data-testid="panel-jklm">
          {/* Active game link */}
          {jklmState && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base select-none" aria-hidden="true">🎮</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-300">Game in progress</p>
                    <p className="text-[10px] text-muted-foreground truncate">Shared by {jklmState.sharedByName}</p>
                  </div>
                </div>
                {jklmState.sharedBy === userId && (
                  <button onClick={clearJklm} className="text-muted-foreground/50 hover:text-muted-foreground" data-testid="button-jklm-clear" aria-label="Clear JKLM game">
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <a
                href={jklmState.url.startsWith("http") ? jklmState.url : `https://jklm.fun/rooms/${jklmState.url.toUpperCase()}`}
                target="_blank" rel="noopener noreferrer"
              >
                <Button size="sm" className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-jklm-join">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Join JKLM Game
                </Button>
              </a>
            </div>
          )}

          {/* Incoming invite */}
          {incomingJklm && (
            <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-3 space-y-2" data-testid="incoming-jklm-invite">
              <div className="flex items-center gap-2">
                <Avatar className="w-7 h-7">
                  {incomingJklm.fromAvatar ? <AvatarImage src={incomingJklm.fromAvatar} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">{incomingJklm.fromUsername?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{incomingJklm.fromUsername} invited you</p>
                  <p className="text-[10px] text-muted-foreground">to play JKLM.fun</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={incomingJklm.url.startsWith("http") ? incomingJklm.url : `https://jklm.fun/rooms/${incomingJklm.url.toUpperCase()}`}
                  target="_blank" rel="noopener noreferrer" className="flex-1"
                  onClick={() => setIncomingJklm(null)}
                >
                  <Button size="sm" variant="default" className="w-full h-8 text-xs" data-testid="button-jklm-accept">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Accept & Join
                  </Button>
                </a>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIncomingJklm(null)} data-testid="button-jklm-decline">
                  <X className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Share form — only shown when no active game */}
          {!jklmState && (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold">JKLM.fun Party Games</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Play Bomb Party, Populate, and more! Create a room on JKLM.fun, copy the 4-letter room code, and invite people below.
                </p>
                <a href="https://jklm.fun" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline" data-testid="link-jklm-open">
                  Open JKLM.fun <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-1.5">
                <Input
                  value={jklmInput}
                  onChange={(e) => { setJklmInput(e.target.value); setJklmError(null); }}
                  placeholder="Room code (e.g. ABCD) or full URL"
                  className="h-8 text-xs"
                  data-testid="input-jklm-code"
                />
                {jklmError && <p className="text-[11px] text-destructive">{jklmError}</p>}
              </div>

              <Button
                size="sm" variant="default" className="w-full h-8 text-xs"
                onClick={() => setShowJklmChallengeList(o => !o)}
                data-testid="button-jklm-challenge-toggle"
              >
                <Swords className="w-3.5 h-3.5 mr-1" /> Select players to invite
              </Button>

              {showJklmChallengeList && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-2 space-y-1.5" data-testid="list-jklm-targets">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Select participants</p>
                  {participants.filter(p => p.id !== userId).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground p-2 text-center">No one else here yet!</p>
                  ) : (
                    participants.filter(p => p.id !== userId).map(p => {
                      const selected = jklmSelected.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setJklmSelected(s => selected ? s.filter(id => id !== p.id) : [...s, p.id])}
                          className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors text-left ${selected ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/40"}`}
                          data-testid={`button-jklm-select-${p.id}`}
                        >
                          <Avatar className="w-7 h-7 shrink-0">
                            {p.profileImageUrl ? <AvatarImage src={p.profileImageUrl} alt="" /> : null}
                            <AvatarFallback className="text-[10px]">{nameOf(p)[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs flex-1">{nameOf(p)}</span>
                          {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })
                  )}
                  {jklmSelected.length > 0 && (
                    <Button
                      size="sm" variant="default" className="w-full h-8 text-xs mt-1"
                      onClick={shareJklm}
                      data-testid="button-jklm-send-invite"
                    >
                      <Swords className="w-3.5 h-3.5 mr-1" /> Share & Invite {jklmSelected.length} player{jklmSelected.length !== 1 ? "s" : ""}
                    </Button>
                  )}
                </div>
              )}

              {!showJklmChallengeList && jklmInput.trim() && (
                <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={shareJklm} data-testid="button-jklm-share-room">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Share with room (no specific invites)
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Connect Four ─── */}
      {tab === "c4" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2" data-testid="panel-c4">
          {!c4State ? (
            <>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base select-none" aria-hidden="true">🔴🟡</span>
                  <p className="text-xs font-semibold">Connect Four</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Challenge someone in this room to a 7-column grid game. Drop your pieces and be the first to connect four in a row — horizontally, vertically, or diagonally. The board opens in a big-screen overlay.
                </p>
              </div>
              <Button
                size="sm" variant="default" className="w-full h-8 text-xs"
                onClick={() => setShowC4ChallengeList(o => !o)}
                data-testid="button-c4-challenge-toggle"
              >
                <Swords className="w-3.5 h-3.5 mr-1" /> Challenge to Connect Four
              </Button>
              {pendingC4To && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300 flex items-center justify-between">
                  <span>Waiting for {pendingC4To.username}…</span>
                  <button onClick={() => setPendingC4To(null)} aria-label="Cancel Connect Four request" data-testid="button-cancel-c4-pending">
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              )}
              {showC4ChallengeList && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-2 space-y-1.5" data-testid="list-c4-targets">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Players in this room</p>
                  {participants.filter(p => p.id !== userId).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground p-2 text-center">No one else here yet!</p>
                  ) : (
                    participants.filter(p => p.id !== userId).map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="w-7 h-7">
                            {p.profileImageUrl ? <AvatarImage src={p.profileImageUrl} alt="" /> : null}
                            <AvatarFallback className="text-[10px]">{nameOf(p)[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate">{nameOf(p)}</span>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" disabled={!!pendingC4To}
                          onClick={() => sendC4Challenge(p)} data-testid={`button-c4-challenge-${p.id}`}>
                          <Swords className="w-3 h-3 mr-1" /> Play
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                <div className="text-center min-w-0">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                    <p className="text-[10px] text-muted-foreground truncate">{c4State.red?.username || "Red"}</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-red-400">{c4State.scores.red}</p>
                </div>
                <div className="text-center px-2">
                  <p className="text-[10px] text-muted-foreground">Draws</p>
                  <p className="text-base font-semibold tabular-nums text-muted-foreground">{c4State.scores.draws}</p>
                </div>
                <div className="text-center min-w-0">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
                    <p className="text-[10px] text-muted-foreground truncate">{c4State.yellow?.username || "Yellow"}</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-yellow-400">{c4State.scores.yellow}</p>
                </div>
              </div>

              <div className="text-center text-xs font-medium py-1">
                {c4State.status === "ended"
                  ? c4State.winner === "draw"
                    ? "Game drawn!"
                    : `${c4State.winner === "red" ? c4State.red?.username : c4State.yellow?.username} wins!`
                  : `${(c4State.turn === "red" ? c4State.red?.username : c4State.yellow?.username) || c4State.turn}'s turn`}
              </div>

              <Button size="sm" className="w-full h-8 text-xs" onClick={() => onOpenC4Board?.()} data-testid="button-c4-open-board">
                <Maximize2 className="w-3.5 h-3.5 mr-1" /> Open Board
              </Button>

              {(c4State.red?.userId === userId || c4State.yellow?.userId === userId) && (
                <div className="flex gap-2">
                  {c4State.status === "ended" && (
                    <Button size="sm" variant="default" className="flex-1 h-8 text-xs"
                      onClick={() => socket?.emit("room:c4-rematch", { roomId })} data-testid="button-c4-rematch">
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rematch
                    </Button>
                  )}
                  {c4State.status === "playing" && (
                    <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs"
                      onClick={() => socket?.emit("room:c4-resign", { roomId })} data-testid="button-c4-resign">
                      <Flag className="w-3.5 h-3.5 mr-1" /> Resign
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                    onClick={() => socket?.emit("room:c4-close", { roomId })} data-testid="button-c4-close">
                    <X className="w-3.5 h-3.5 mr-1" /> End match
                  </Button>
                </div>
              )}
            </div>
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

      {/* Incoming Connect Four dialog */}
      <Dialog open={!!incomingC4} onOpenChange={(o) => { if (!o) respondC4(false); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-incoming-c4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span aria-hidden="true">🔴🟡</span> Connect Four Challenge!
            </DialogTitle>
            <DialogDescription asChild>
              {incomingC4 ? (
                <span className="flex items-center gap-2 mt-2">
                  <Avatar className="w-8 h-8">
                    {incomingC4.fromAvatar ? <AvatarImage src={incomingC4.fromAvatar} alt="" /> : null}
                    <AvatarFallback>{incomingC4.fromUsername?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>
                    <strong className="text-foreground">{incomingC4.fromUsername}</strong> wants to play Connect Four with you!
                  </span>
                </span>
              ) : <span />}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => respondC4(false)} data-testid="button-decline-c4">Decline</Button>
            <Button className="flex-1" onClick={() => respondC4(true)} data-testid="button-accept-c4">
              <Check className="w-3.5 h-3.5 mr-1" /> Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
