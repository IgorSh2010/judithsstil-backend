import express from "express";
import multer from "multer";
import { createProduct, getProducts, changeAvailability, deleteProduct } from "../controllers/productController.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
//import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка

router.post("/create", tenantResolver, upload.array("images", 8), createProduct); //authenticateToken
router.get("/get", tenantResolver, getProducts); //authenticateToken
router.put("/:id/availability", tenantResolver, changeAvailability); //authenticateToken
router.delete("/:id", tenantResolver, deleteProduct); //authenticateToken 

export default router;
