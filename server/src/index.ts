import { createServer } from "node:http";
import app from "./app";
import { prisma } from "./lib/prisma";
import { setupSocket } from "./socket";
import type { AppServer } from "./socket/types";

const PORT = process.env.PORT ?? 5000;

let httpServer: ReturnType<typeof createServer>;
let io: AppServer;

async function shutdown(): Promise<void> {
  io.close();
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }

  httpServer = createServer(app);
  io = setupSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket ready (Socket.IO)`);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

void start();
