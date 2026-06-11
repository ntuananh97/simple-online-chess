import { Router } from "express";
import {
  createRoomHandler,
  joinRoomHandler,
} from "../controllers/room.controller";

const router = Router();

router.post("/", createRoomHandler);
router.post("/join", joinRoomHandler);

export default router;
