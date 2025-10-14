import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { pool } from "../middleware/dbConn.js";

const router = express.Router();

// Отримати улюблені товари
router.get("/", authMiddleware, async (req, res) => {
  const { id: userId } = req.user;
  const result = await pool.query(
    "SELECT f.id, f.product_id, p.title, p.price, p.image_url FROM favorites f JOIN products p ON f.product_id = p.id WHERE f.user_id = $1",
    [userId]
  );
  res.json(result.rows);
});

// Додати до улюблених
router.post("/", authMiddleware, async (req, res) => {
  const { productId } = req.body;
  const { id: userId } = req.user;
  await pool.query("INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    userId,
    productId,
  ]);
  res.json({ message: "Додано до улюблених" });
});

// Видалити з улюблених
router.delete("/:productId", authMiddleware, async (req, res) => {
  const { productId } = req.params;
  const { id: userId } = req.user;
  await pool.query("DELETE FROM favorites WHERE user_id = $1 AND product_id = $2", [userId, productId]);
  res.json({ message: "Видалено з улюблених" });
});

export default router;
