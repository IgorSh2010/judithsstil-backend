import express from "express";
import { getLogo, getBanner } from "../controllers/publicController.js";

const router = express.Router();

router.get("/logo", getLogo);
router.get("/banner", getBanner);

export default router;