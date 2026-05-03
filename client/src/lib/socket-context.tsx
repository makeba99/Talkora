import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

export interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  appearOffline: boolean;
  setAppearOffline: (v: boolean) => void;
}

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  appearOffline: false,
  setAppearOffline: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}
