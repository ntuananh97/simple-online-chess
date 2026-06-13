import type { IRoomResponse, RoomStatus } from "./room.types";

export interface JoinRoomPayload {
  code: string;
  playerId: string;
}

export interface JoinRoomAck {
  ok: boolean;
  room?: IRoomResponse;
  error?: string;
}

export interface PlayerJoinedPayload {
  playerId: string;
  status: RoomStatus;
}

export interface PlayerLeftPayload {
  playerId: string;
}

export interface ClientToServerEvents {
  "room:join": (
    payload: JoinRoomPayload,
    ack?: (response: JoinRoomAck) => void,
  ) => void;
  "room:leave": () => void;
}

export interface ServerToClientEvents {
  "room:player-joined": (payload: PlayerJoinedPayload) => void;
  "room:player-left": (payload: PlayerLeftPayload) => void;
  "room:error": (payload: { message: string }) => void;
}
