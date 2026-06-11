import type { Request, Response } from "express";
import { createRoom, joinRoom, JoinRoomError } from "../models/room.model";
import type { CreateRoomBody, JoinRoomBody } from "../types/room.types";
import {
  formatCreateRoomResponse,
  formatJoinRoomResponse,
} from "../views/room.view";

export async function createRoomHandler(
  req: Request<object, object, CreateRoomBody>,
  res: Response,
): Promise<void> {
  const { whiteId } = req.body;

  const room = await createRoom(whiteId);
  res.status(201).json(formatCreateRoomResponse(room));
}

export async function joinRoomHandler(
  req: Request<object, object, JoinRoomBody>,
  res: Response,
): Promise<void> {
  const { code, blackId } = req.body;

  if (!code || !blackId) {
    res.status(400).json({ error: "code and blackId are required" });
    return;
  }

  try {
    const room = await joinRoom(code, blackId);
    res.json(formatJoinRoomResponse(room));
  } catch (error) {
    if (error instanceof JoinRoomError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    throw error;
  }
}
