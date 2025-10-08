import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

router.get("/me", authMiddleware, async (req, res) => {
  // тут req.user — розшифрований payload з JWT
  // Якщо токен містить id: req.user.id
  const userId = req.user?.id || req.user?.sub;
  // отримати дані з БД (через pool)
  const result = await pool.query("SELECT id, email, username, role FROM users WHERE id = $1", [userId]);
  return res.json({ user: result.rows[0] });
});

router.get("/admin-only", authMiddleware, requireRole("admin"), (req, res) => {
  res.json({ ok: true });
});

export default router;
