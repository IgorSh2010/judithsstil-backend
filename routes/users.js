import express from "express";
import { userUpdate } from "../controllers/userController.js";

const router = express.Router();

router.put("/update", userUpdate); //, authenticateToken
  

// router.get("/admin-only", authMiddleware, requireRole("admin"), (req, res) => {
//   res.json({ ok: true });
// });

export default router;
