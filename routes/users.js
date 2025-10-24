import express from "express";
import { userUpdate } from "../controllers/userController.js";
import { uploadImage } from "../controllers/settingsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/update", authenticateToken, userUpdate); //, 
router.post("/upload-image", authenticateToken, uploadImage);  

// router.get("/admin-only", authMiddleware, requireRole("admin"), (req, res) => {
//   res.json({ ok: true });
// });

export default router;
