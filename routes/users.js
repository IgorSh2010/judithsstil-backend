import express from "express";
import multer from "multer";
import { userUpdate } from "../controllers/userController.js";
import { uploadImage, getImage } from "../controllers/settingsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getClientOrder } from "../controllers/ordersController.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка

router.post("/update", authenticateToken, userUpdate); // 
router.post("/upload-image", tenantResolver, authenticateToken, upload.single("image"), uploadImage);  
router.get("/get-image", tenantResolver, authenticateToken, getImage);
router.get("/client-order", tenantResolver, authenticateToken, getClientOrder);


// router.get("/admin-only", authMiddleware, requireRole("admin"), (req, res) => {
//   res.json({ ok: true });
// });

export default router;
