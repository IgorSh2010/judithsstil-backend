import express from "express";
import multer from "multer";
import { createProduct, updateProduct, getProducts, deleteProduct, 
         getFavorites, getStatsDashboard } from "../controllers/productController.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка

router.get("/get", tenantResolver, authenticateToken, getProducts);
router.get("/get/:id", tenantResolver, authenticateToken, getProducts);
router.get("/favorites/:id", tenantResolver, authenticateToken, getFavorites);
router.get("/stats", tenantResolver, authenticateToken, getStatsDashboard);

//router.put("upload-image/:id", tenantResolver, authenticateToken,  uploadImages);
//router.put("/:id/availability", tenantResolver, changeAvailability); 
router.put("/update/:id", tenantResolver, authenticateToken, upload.array("images", 7), updateProduct);

router.post("/create", tenantResolver, authenticateToken, upload.array("images", 8), createProduct);

router.delete("/:id", tenantResolver, authenticateToken, deleteProduct); 

export default router;
