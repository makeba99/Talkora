import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

export function SocketProvider({ children, userId }: { children: React.ReactNode; userId: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

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
      s.emit("user:online", userId);
      startHeartbeat();
    });

    s.on("reconnect", () => {
      s.emit("user:online", userId);
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
          s.emit("user:online", userId);
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
  }, [userId]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
