import dotenv from "dotenv";
import bcrypt  from "bcrypt";
import { pool } from "../middleware/dbConn.js";

dotenv.config();

export const userUpdate = async (req, res) => {
  const { username, email, phone, adress, password } = req.body;

  if (!req.user) {
    return res.status(401).json({ message: "Nieautoryzowany" });
  }

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
    if (phone) {
      updates.push(`phone = $${idx++}`);
      values.push(phone);
    }
    if (adress) {
      updates.push(`adress = $${idx++}`);
      values.push(adress);
    }
    if (password) {
      updates.push(`password = $${idx++}`);
      values.push(bcrypt.hash(password, 10)); // в реальному проекті — bcrypt.hash(password, 10)
    }

    if (updates.length === 0) return res.json({ message: "Nic do zmiany" });

    values.push(req.user.id);
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, username, email`;
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }

    res.json({
      message: "Dane pomyślnie zapisane!",
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};


