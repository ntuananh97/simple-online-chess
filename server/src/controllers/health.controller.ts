import type { Request, Response } from "express";
import { getHealthData } from "../models/health.model";
import { formatHealthResponse } from "../views/health.view";

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const data = await getHealthData();
  res.json(formatHealthResponse(data));
}
