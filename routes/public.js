import express from "express";
import { getLogo, getBanner, getCategories } from "../controllers/publicController.js";

const router = express.Router();

router.get("/logo", getLogo);
router.get("/banner", getBanner);
router.get("/categories", getBanner);

export default router;