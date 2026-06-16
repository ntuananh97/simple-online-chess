import type { RoomData } from "./room.types";

export interface JoinRoomPayload {
  code: string;
  playerId: string;
}

export interface JoinRoomAck {
  ok: boolean;
  room?: RoomData;
  error?: string;
}

export interface PlayerJoinedPayload {
  playerId: string;
  status: RoomData["status"];
}

export interface PlayerLeftPayload {
  playerId: string;
}

export interface RoomStatePayload {
  id: string;
  code: string;
  status: RoomData["status"];
  fen: string;
  turn: "w" | "b";
  whiteId: string | null;
  blackId: string | null;
}

interface IChessMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface RoomMovePayload {
  move: IChessMove;
  roomId: string;
}

export interface IGameOverPayload {
  winner: "white" | "black" | null;
  reason: "draw" | "checkmate";
}

export interface ClientToServerEvents {
  "room:join": (
    payload: JoinRoomPayload,
    ack?: (response: JoinRoomAck) => void,
  ) => void;
  "room:leave": () => void;
  "room:move": (payload: RoomMovePayload) => void;
}

export interface ServerToClientEvents {
  "room:player-joined": (payload: PlayerJoinedPayload) => void;
  "room:player-left": (payload: PlayerLeftPayload) => void;
  "room:state": (payload: RoomStatePayload) => void;
  "room:error": (payload: { message: string }) => void;
  "room:move-made": (payload: IChessMove) => void;
  "room:move-rejected": (payload: { fen: string, error: string }) => void;
  "room:game-over": (payload: IGameOverPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  playerId?: string;
  roomId?: string;
  playerColor?: "w" | "b";
}
