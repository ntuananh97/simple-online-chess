"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { disconnectSocket, getSocket, type AppSocket } from "@/lib/socket";

interface SocketContextValue {
  socket: AppSocket;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket] = useState(() => getSocket());
  const [connected, setConnected] = useState(socket.connected);

  const connect = useCallback(() => {
    if (!socket.connected) {
      socket.connect();
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket.connected) {
      socket.disconnect();
    }
  }, [socket]);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      disconnectSocket();
    };
  }, [socket, connect]);

  const value = useMemo(
    () => ({ socket, connected, connect, disconnect }),
    [socket, connected, connect, disconnect],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }

  return context;
}
