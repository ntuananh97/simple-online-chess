import type { RoomStatus } from "../generated/prisma/client";

export interface RoomData {
  id: string;
  code: string;
  status: RoomStatus;
  createdAt: Date;
}

export interface CreateRoomBody {
  whiteId: string;
}

export interface JoinRoomBody {
  code: string;
  blackId: string;
}
