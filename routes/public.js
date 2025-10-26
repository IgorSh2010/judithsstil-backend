import express from "express";
import { getLogo } from "../controllers/publicController.js";

const router = express.Router();

router.get("/logo", getLogo);

export default router;