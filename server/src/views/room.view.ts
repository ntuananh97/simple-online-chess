import type { RoomData } from "../types/room.types";

function formatRoomResponse(data: RoomData) {
  return {
    id: data.id,
    code: data.code,
    status: data.status,
    createdAt: data.createdAt.toISOString(),
  };
}

export function formatCreateRoomResponse(data: RoomData) {
  return formatRoomResponse(data);
}

export function formatJoinRoomResponse(data: RoomData) {
  return formatRoomResponse(data);
}

export function formatGetRoomResponse(data: RoomData) {
  return formatRoomResponse(data);
}
