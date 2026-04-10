import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@shared/schema";
import { apiRequest } from "./queryClient";
import { useSocket } from "./socket";

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (username: string) => Promise<User>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  login: async () => ({} as User),
  isLoading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    const stored = localStorage.getItem("connect2talk_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        if (socket && parsed) {
          socket.emit("user:online", parsed.id);
        }
      } catch {
        localStorage.removeItem("connect2talk_user");
      }
    }
    setIsLoading(false);
  }, [socket]);

  const login = async (username: string) => {
    const res = await apiRequest("POST", "/api/users", { username });
    const userData = await res.json();
    setUser(userData);
    localStorage.setItem("connect2talk_user", JSON.stringify(userData));
    if (socket) {
      socket.emit("user:online", userData.id);
    }
    return userData;
  };

  return (
    <UserContext.Provider value={{ user, setUser, login, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
