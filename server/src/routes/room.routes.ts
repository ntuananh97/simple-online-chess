import { Router } from "express";
import {
  createRoomHandler,
  getRoomHandler,
  joinRoomHandler,
} from "../controllers/room.controller";

const router = Router();

router.post("/", createRoomHandler);
router.post("/join", joinRoomHandler);
router.get("/:code", getRoomHandler);

export default router;
