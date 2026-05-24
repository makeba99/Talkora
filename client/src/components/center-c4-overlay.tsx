import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, Minus, Maximize2, Minimize2, Flag, RefreshCw } from "lucide-react";
import type { Socket } from "socket.io-client";

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

interface Props {
  socket: Socket | null;
  roomId: string;
  userId: string;
  forceOpen?: boolean;
  onClose?: () => void;
}

const ROWS = 6;
const COLS = 7;
const RED = "#ef4444";
const YELLOW = "#eab308";
const EMPTY = "rgba(255,255,255,0.06)";
const EMPTY_BORDER = "rgba(255,255,255,0.10)";

export function CenterC4Overlay({ socket, roomId, userId, forceOpen, onClose }: Props) {
  const [state, setState] = useState<C4State | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posInitialized = useRef(false);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  useEffect(() => {
    if (!posInitialized.current) {
      setPos({
        x: Math.max(20, Math.floor(window.innerWidth / 2) - 190),
        y: 60,
      });
      posInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit("room:c4-sync", { roomId });
    const onState = (s: C4State | null) => {
      setState(s);
      if (s && s.status === "playing") {
        setDismissed(false);
        setMinimized(false);
      }
    };
    socket.on("room:c4-state", onState);
    return () => { socket.off("room:c4-state", onState); };
  }, [socket, roomId]);

  useEffect(() => {
    if (forceOpen) { setDismissed(false); setMinimized(false); }
  }, [forceOpen]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.startLeft + dx, y: dragRef.current.startTop + dy });
    };
    const onUp = () => { dragRef.current.active = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    if (fullscreen) return;
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startLeft: pos.x, startTop: pos.y };
    e.preventDefault();
  };

  const myColor: "red" | "yellow" | null = state?.red?.userId === userId ? "red" : state?.yellow?.userId === userId ? "yellow" : null;
  const isMyTurn = state?.status === "playing" && state.turn === myColor;
  const isPlayer = !!myColor;

  const dropPiece = useCallback((col: number) => {
    if (!isMyTurn || !socket) return;
    socket.emit("room:c4-drop", { roomId, col });
  }, [isMyTurn, socket, roomId]);

  const isWinCell = (r: number, c: number) =>
    !!state?.winLine?.some(([wr, wc]) => wr === r && wc === c);

  const getDropRow = (col: number): number => {
    if (!state) return -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (state.board[r][col] === null) return r;
    }
    return -1;
  };

  if (!state || dismissed) return null;

  const overlayStyle: React.CSSProperties = fullscreen
    ? { position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }
    : { position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, width: 380 };

  const panelStyle: React.CSSProperties = fullscreen
    ? { background: "linear-gradient(145deg, #1a1625, #120f1e)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", padding: 24, minWidth: 340, maxWidth: 480, width: "100%" }
    : { background: "linear-gradient(145deg, #1a1625, #120f1e)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", overflow: "hidden" };

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} data-testid="c4-overlay">

        {/* Header */}
        <div
          onMouseDown={startDrag}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: fullscreen ? "default" : "grab", userSelect: "none", background: "rgba(255,255,255,0.03)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>🔴🟡</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>Connect Four</span>
            {state.status === "playing" && (
              <span style={{ fontSize: 10, color: state.turn === "red" ? RED : YELLOW, background: state.turn === "red" ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)", borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>
                {state.turn === "red" ? state.red?.username : state.yellow?.username}'s turn
              </span>
            )}
            {state.status === "ended" && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "2px 7px" }}>
                {state.winner === "draw" ? "Draw!" : `${state.winner === "red" ? state.red?.username : state.yellow?.username} wins!`}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setMinimized(m => !m)} style={{ padding: 4, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }} data-testid="c4-minimize" aria-label={minimized ? "Expand board" : "Minimize board"}>
              <Minus className="w-3 h-3" />
            </button>
            <button onClick={() => setFullscreen(f => !f)} style={{ padding: 4, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }} data-testid="c4-fullscreen" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {fullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
            <button onClick={() => { setDismissed(true); onClose?.(); }} style={{ padding: 4, borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "none", color: "#ef4444", cursor: "pointer" }} data-testid="c4-close" aria-label="Close Connect Four">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {!minimized && (
          <div style={{ padding: fullscreen ? "20px 24px" : "12px 12px 14px" }}>

            {/* Score row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
              <PlayerCard seat={state.red} color="red" score={state.scores.red} isMyTurn={state.turn === "red" && state.status === "playing"} isMe={myColor === "red"} />
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>draws</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{state.scores.draws}</div>
              </div>
              <PlayerCard seat={state.yellow} color="yellow" score={state.scores.yellow} isMyTurn={state.turn === "yellow" && state.status === "playing"} isMe={myColor === "yellow"} />
            </div>

            {/* Column drop buttons */}
            {state.status === "playing" && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 3, marginBottom: 4 }}>
                {Array.from({ length: COLS }, (_, c) => {
                  const dropRow = getDropRow(c);
                  const canDrop = isMyTurn && dropRow !== -1;
                  return (
                    <button
                      key={c}
                      onClick={() => dropPiece(c)}
                      onMouseEnter={() => setHoverCol(c)}
                      onMouseLeave={() => setHoverCol(null)}
                      disabled={!canDrop}
                      data-testid={`c4-col-${c}`}
                      aria-label={`Drop in column ${c + 1}`}
                      style={{
                        height: 24,
                        borderRadius: 6,
                        border: "none",
                        background: hoverCol === c && canDrop
                          ? myColor === "red" ? "rgba(239,68,68,0.25)" : "rgba(234,179,8,0.25)"
                          : "rgba(255,255,255,0.05)",
                        cursor: canDrop ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.15s",
                      }}
                    >
                      {canDrop && hoverCol === c && (
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: myColor === "red" ? RED : YELLOW, opacity: 0.85 }} />
                      )}
                      {canDrop && hoverCol !== c && (
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>↓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Board grid */}
            <div style={{ background: "rgba(15,12,25,0.6)", borderRadius: 10, padding: 6, border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)`, gap: 4 }}>
                {Array.from({ length: ROWS }, (_, r) =>
                  Array.from({ length: COLS }, (_, c) => {
                    const cell = state.board[r][c];
                    const win = isWinCell(r, c);
                    const isPreview = state.status === "playing" && isMyTurn && hoverCol === c && getDropRow(c) === r;
                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => dropPiece(c)}
                        style={{
                          aspectRatio: "1",
                          borderRadius: "50%",
                          background: cell === "red" ? RED : cell === "yellow" ? YELLOW : isPreview ? (myColor === "red" ? "rgba(239,68,68,0.35)" : "rgba(234,179,8,0.35)") : EMPTY,
                          border: win ? `2px solid rgba(255,255,255,0.9)` : `1px solid ${EMPTY_BORDER}`,
                          boxShadow: win
                            ? `0 0 12px ${cell === "red" ? RED : YELLOW}, 0 0 24px ${cell === "red" ? "rgba(239,68,68,0.5)" : "rgba(234,179,8,0.5)"}`
                            : cell ? `inset 0 2px 4px rgba(0,0,0,0.3)` : "none",
                          cursor: state.status === "playing" && isMyTurn && !cell ? "pointer" : "default",
                          transition: "background 0.1s, box-shadow 0.15s",
                        }}
                        data-testid={`c4-cell-${r}-${c}`}
                        aria-label={`Row ${r + 1} column ${c + 1}: ${cell || "empty"}`}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Status message */}
            {state.status === "ended" && (
              <div style={{ textAlign: "center", marginTop: 10, padding: "6px 10px", borderRadius: 8, background: state.winner === "draw" ? "rgba(255,255,255,0.06)" : state.winner === "red" ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)", color: state.winner === "draw" ? "rgba(255,255,255,0.6)" : state.winner === "red" ? RED : YELLOW, fontSize: 12, fontWeight: 600 }}>
                {state.winner === "draw" ? "It's a draw!" : `${state.winner === "red" ? state.red?.username : state.yellow?.username} wins! 🎉`}
              </div>
            )}

            {/* Action buttons */}
            {isPlayer && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {state.status === "ended" && (
                  <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={() => socket?.emit("room:c4-rematch", { roomId })} data-testid="c4-rematch">
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rematch
                  </Button>
                )}
                {state.status === "playing" && (
                  <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => socket?.emit("room:c4-resign", { roomId })} data-testid="c4-resign">
                    <Flag className="w-3.5 h-3.5 mr-1" /> Resign
                  </Button>
                )}
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => socket?.emit("room:c4-close", { roomId })} data-testid="c4-end-match">
                  <X className="w-3.5 h-3.5 mr-1" /> End match
                </Button>
              </div>
            )}
            {!isPlayer && state.status === "playing" && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Spectating</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ seat, color, score, isMyTurn, isMe }: { seat: C4Seat; color: "red" | "yellow"; score: number; isMyTurn: boolean; isMe: boolean }) {
  const accent = color === "red" ? RED : YELLOW;
  const bgActive = color === "red" ? "rgba(239,68,68,0.10)" : "rgba(234,179,8,0.10)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 10, background: isMyTurn ? bgActive : "rgba(255,255,255,0.04)", border: `1px solid ${isMyTurn ? accent + "40" : "rgba(255,255,255,0.06)"}`, flex: 1, minWidth: 0, transition: "all 0.2s" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent, flexShrink: 0, boxShadow: isMyTurn ? `0 0 8px ${accent}` : "none" }} />
      <Avatar className="w-6 h-6 shrink-0">
        {seat?.avatar ? <AvatarImage src={seat.avatar} alt="" /> : null}
        <AvatarFallback style={{ fontSize: 9 }}>{seat?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
      </Avatar>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", truncate: true, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isMe ? "You" : seat?.username || (color === "red" ? "Red" : "Yellow")}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{score}</div>
      </div>
    </div>
  );
}
