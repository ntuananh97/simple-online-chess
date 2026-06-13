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
    // const handler = ((...args: Parameters<ServerToClientEvents[E]>) => {
    //   (callbackRef.current as (...args: Parameters<ServerToClientEvents[E]>) => void)(
    //     ...args,
    //   );
    // }) as ServerToClientEvents[E];

    if (!socket) return;

    const handler = callbackRef.current

    const on = socket.on as (ev: E, fn: ServerToClientEvents[E]) => void;
    const off = socket.off as (ev: E, fn: ServerToClientEvents[E]) => void;
    // const on = socket.on as (ev: E, fn: ServerToClientEvents[E]) => void;
    // const off = socket.off as (ev: E, fn: ServerToClientEvents[E]) => void;

    on(event, handler);

    return () => {
      off(event, handler);
    };
  }, [socket, event]);
}
