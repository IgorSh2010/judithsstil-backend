import express from "express";
import multer from "multer";
import { createProduct } from "../controllers/productController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка

router.post("/create", authenticateToken, upload.array("images", 8), createProduct);

export default router;
