import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { registerRoomHandlers } from "./handlers/room.handler";
import type { AppServer } from "./types";

export function setupSocket(httpServer: HttpServer): AppServer {
  const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

  const io: AppServer = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    registerRoomHandlers(socket);
  });

  return io;
}
