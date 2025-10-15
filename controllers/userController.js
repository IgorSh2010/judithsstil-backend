import dotenv from "dotenv";
import { pool } from "../middleware/dbConn.js";
//import { authenticateToken } from "../middleware/authMiddleware.js";
//import { requireRole } from "../middleware/requireRole.js";

dotenv.config();

export const userUpdate = async (req, res) => {
  const { username, email, password } = req.body;
    try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (username) {
      updates.push(`username = $${idx++}`);
      values.push(username);
    }
    if (email) {
      updates.push(`email = $${idx++}`);
      values.push(email);
    }
    if (password) {
      updates.push(`password = $${idx++}`);
      values.push(password); // у реальному проекті хешувати bcrypt
    }

    if (updates.length === 0) return res.json({ message: "Nic do zmiany" });

    values.push(req.user.id);
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, username, email`;
    await pool.query(query, values);
    res.json({
          message: "Dane pomyślnie zapisane!",
        });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};

