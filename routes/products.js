import express from "express";
import multer from "multer";
import { createProduct } from "../controllers/productController.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка

router.post("/create", upload.array("images", 8), createProduct);

export default router;
