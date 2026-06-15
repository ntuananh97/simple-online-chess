"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ServerToClientEvents } from "@/types/socket.types";
import { useSocket } from "@/providers/SocketProvider";

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useListenEvent<E extends keyof ServerToClientEvents>(
  event: E,
  callback: ServerToClientEvents[E],
) {
  const { socket } = useSocket();
  const callbackRef = useRef(callback);

  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler = (...args: Parameters<ServerToClientEvents[E]>) => {
      (callbackRef.current as (...args: Parameters<ServerToClientEvents[E]>) => void)(
        ...args,
      );
    };

    const on = socket.on.bind(socket) as (ev: E, fn: typeof handler) => void;
    const off = socket.off.bind(socket) as (ev: E, fn: typeof handler) => void;

    on(event, handler);

    return () => {
      off(event, handler);
    };
  }, [socket, event]);
}
