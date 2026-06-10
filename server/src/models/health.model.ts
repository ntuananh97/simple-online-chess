import { prisma } from "../lib/prisma";

export interface HealthData {
  message: string;
  database: "connected" | "disconnected";
}

export async function getHealthData(): Promise<HealthData> {
  let database: HealthData["database"] = "disconnected";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    database = "disconnected";
  }

  return {
    message: "Simple Online Chess API",
    database,
  };
}
