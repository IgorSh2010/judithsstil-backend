import express from "express";
import multer from "multer";
import { createProduct, updateProduct, getProducts, changeAvailability, deleteProduct } from "../controllers/productController.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка

router.post("/create", tenantResolver, authenticateToken, upload.array("images", 8), createProduct);
router.get("/get", tenantResolver, getProducts); //authenticateToken
router.put("/:id/availability", tenantResolver, changeAvailability); 
router.put("/update/:id", tenantResolver, authenticateToken, upload.array("images", 7), updateProduct);
//router.put("upload-image/:id", tenantResolver, authenticateToken,  uploadImages);
router.delete("/:id", tenantResolver, authenticateToken, deleteProduct); //authenticateToken 

export default router;
