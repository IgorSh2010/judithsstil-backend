import express from "express";
import multer from "multer";
import { userUpdate, getMe } from "../controllers/userController.js";
import { uploadImage, getImage } from "../controllers/settingsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { tenantResolver } from "../middleware/tenantResolver.js";
import { getClientOrder, getClientCart } from "../controllers/ordersController.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" }); // тимчасова папка

router.post("/update", authenticateToken, userUpdate); // 
router.post("/upload-image", tenantResolver, authenticateToken, upload.single("image"), uploadImage);  
router.get("/get-image", tenantResolver, authenticateToken, getImage);
router.get("/client-cart", tenantResolver, authenticateToken, getClientCart);
router.get("/client-order/:id", tenantResolver, authenticateToken, getClientOrder);

// 🧑‍💻 Отримати поточного користувача
router.get("/me", authenticateToken, getMe);


// router.get("/admin-only", authMiddleware, requireRole("admin"), (req, res) => {
//   res.json({ ok: true });
// });

export default router;
