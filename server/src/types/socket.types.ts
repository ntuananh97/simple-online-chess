import { TimeSnapshot } from "../models/game.model";
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
  time: TimeSnapshot;
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
  whiteTimeLeft: number;
  blackTimeLeft: number;
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

export type RoomMoveAck = TimeSnapshot

export type MoveMadePayload = IChessMove & TimeSnapshot;

export interface IGameOverPayload {
  winner: "white" | "black" | null;
  reason: "draw" | "checkmate" | "abandoned" | "timeout";
}

export interface RoomAbandonedPayload {
  fen: string;
  status: "ABANDONED";
  abandonedBy: string | 'both';
}

export interface ClientToServerEvents {
  "room:join": (
    payload: JoinRoomPayload,
    ack?: (response: JoinRoomAck) => void,
  ) => void;
  "room:leave": () => void;
  "room:move": (
    payload: RoomMovePayload,
    ack?: (response: RoomMoveAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "room:player-joined": (payload: PlayerJoinedPayload) => void;
  "room:player-left": (payload: PlayerLeftPayload) => void;
  "room:state": (payload: RoomStatePayload) => void;
  "room:error": (payload: { message: string }) => void;
  "room:move-made": (payload: MoveMadePayload) => void;
  "room:move-rejected": (payload: { fen: string, error: string }) => void;
  "room:game-over": (payload: IGameOverPayload) => void;
  "room:abandoned": (payload: RoomAbandonedPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  playerId?: string;
  roomId?: string;
  playerColor?: "w" | "b";
}
