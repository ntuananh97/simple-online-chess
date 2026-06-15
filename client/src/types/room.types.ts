export type RoomStatus = "WAITING" | "PLAYING" | "COMPLETED" | "ABANDONED";

export interface IRoomResponse {
  id: string;
  code: string;
  status: RoomStatus;
  fen: string;
  whiteId?: string;
  blackId?: string;
  createdAt: string;
}

export type ICreateRoomResponse = IRoomResponse;

export interface JoinRoomBody {
  code: string;
  blackId: string;
}