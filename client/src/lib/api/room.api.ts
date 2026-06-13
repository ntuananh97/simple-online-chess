import { apiFetch } from "./fetch";
import type {
  ICreateRoomResponse,
  IRoomResponse,
  JoinRoomBody,
} from "@/types/room.types";

export const roomApi = {
  createRoom: (whiteId: string) =>
    apiFetch<ICreateRoomResponse>("/rooms", {
      method: "POST",
      body: { whiteId },
    }),

  joinRoom: (payload: JoinRoomBody) =>
    apiFetch<IRoomResponse>("/rooms/join", {
      method: "POST",
      body: payload,
    }),

  getRoom: (code: string, playerId: string) =>
    apiFetch<IRoomResponse>(
      `/rooms/${encodeURIComponent(code)}?playerId=${encodeURIComponent(playerId)}`,
    ),
};
