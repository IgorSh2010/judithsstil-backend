import express from "express";
import { getLogo, getBanner, getCategories,
         getProducts } from "../controllers/publicController.js";

const router = express.Router();

router.get("/logo", getLogo);
router.get("/banner", getBanner);
router.get("/categories", getCategories);
router.get("/getProducts", getProducts);

export default router;