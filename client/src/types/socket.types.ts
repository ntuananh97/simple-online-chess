import { IChessMove } from "./chess.types";
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

export interface RoomStatePayload {
  id: string;
  code: string;
  status: RoomStatus;
  fen: string;
  turn: "w" | "b";
  whiteId: string | null;
  blackId: string | null;
}

export interface RoomMovePayload {  
  move: IChessMove;
  roomId: string;
}

export interface IGameOverPayload {
  winner: "white" | "black";
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
  "room:move-rejected": (payload: { fen: string, error: string }) => void;
  "room:move-made": (payload: IChessMove) => void;
  "room:game-over": (payload: IGameOverPayload) => void;
}
