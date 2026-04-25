import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const APPEAR_OFFLINE_KEY = "connect2talk:appearOffline";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  appearOffline: boolean;
  setAppearOffline: (v: boolean) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  appearOffline: false,
  setAppearOffline: () => {},
});

export function SocketProvider({ children, userId }: { children: React.ReactNode; userId: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [appearOffline, setAppearOfflineState] = useState<boolean>(
    () => localStorage.getItem(APPEAR_OFFLINE_KEY) === "true"
  );
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const appearOfflineRef = useRef(appearOffline);
  appearOfflineRef.current = appearOffline;

  const emitOnline = useCallback((s: Socket) => {
    if (!appearOfflineRef.current && s.connected) {
      s.emit("user:online", userId);
    }
  }, [userId]);

  useEffect(() => {
    const s = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 30000,
      forceNew: false,
    });
    socketRef.current = s;

    const startHeartbeat = () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (s.connected) {
          s.emit("heartbeat");
        }
      }, 10000);
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    s.on("connect", () => {
      setConnected(true);
      emitOnline(s);
      startHeartbeat();
    });

    s.on("reconnect", () => {
      emitOnline(s);
      startHeartbeat();
    });

    s.on("disconnect", () => {
      setConnected(false);
      stopHeartbeat();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!s.connected) {
          s.connect();
        } else {
          emitOnline(s);
          s.emit("heartbeat");
        }
      }
    };

    const handleOnline = () => {
      if (!s.connected) {
        s.connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleVisibilityChange);

    setSocket(s);

    return () => {
      stopHeartbeat();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleVisibilityChange);
      s.disconnect();
    };
  }, [userId, emitOnline]);

  const setAppearOffline = useCallback((value: boolean) => {
    localStorage.setItem(APPEAR_OFFLINE_KEY, String(value));
    setAppearOfflineState(value);
    const s = socketRef.current;
    if (!s || !s.connected) return;
    if (value) {
      s.emit("user:offline", userId);
    } else {
      s.emit("user:online", userId);
    }
  }, [userId]);

  return (
    <SocketContext.Provider value={{ socket, connected, appearOffline, setAppearOffline }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
