import { Router } from "express";
import healthRoutes from "./health.routes";
import roomRoutes from "./room.routes";

const router = Router();

router.use("/", healthRoutes);
router.use("/rooms", roomRoutes);

export default router;
