import express from "express";
import { getLogo, getBanner, getCategories,
         getProducts, getTest } from "../controllers/publicController.js";

const router = express.Router();

router.get("/logo", getLogo);
router.get("/banner", getBanner);
router.get("/categories", getCategories);
router.get("/getProducts", getProducts);
router.get("/getProducts/:id", getProducts);

// 🧪 Тестовий ендпоінт
router.get("/test-db", getTest);

export default router;