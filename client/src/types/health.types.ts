export interface HealthResponse {
  message: string;
  database: "connected" | "disconnected";
}
