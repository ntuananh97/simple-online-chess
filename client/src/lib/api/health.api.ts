import type { HealthResponse } from "@/types/health.types";
import { apiFetch } from "./fetch";

export const healthApi = {
  getHealth: () => apiFetch<HealthResponse>("/"),
};
