import dotenv from "dotenv";
import bcrypt  from "bcrypt";
import { getClientPool } from "../middleware/ClientPool.js";

dotenv.config();

export const userUpdate = async (req, res) => {
  const { username, email, phone, adress, password } = req.body;
  const client = await getClientPool();

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
    const result = await client.query(query, values);

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
  } finally {
    client.release();
  }
};

export const getMe = async (req, res) => {
  const client = await getClientPool();
  try {
    // req.user.id — це id користувача з токена
    const result = await client.query(
      "SELECT id, email, username, tenant, phone, adress, role FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "User not founded!" });

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("❌ Помилка при отриманні користувача:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const getStats = async (req, res) => {
  const client = await getClientPool();
  const user_id = req.user?.id;

  try {
    let newOrders = 0;

    const userResult = await client.query(
            `SELECT role FROM public.users WHERE id = $1`,
            [user_id]
        );
    const role = userResult.rows[0]?.role;

    if (role === "admin") {
       newOrders = (await client.query("SELECT COUNT(*) as order_count FROM orders WHERE status_id = 1")).rows[0].order_count; 
    }
    
    const newMessages = await client.query("SELECT COUNT(*) as message_count FROM messages WHERE sender_id != $1 and not is_read", [user_id]);

    const result = [{
      newOrders: newOrders || 0,
      newMessages: newMessages.rows[0].message_count || 0
    }];

    res.json( result );

  } catch (err) {
    console.error("❌ Помилка при отриманні статистики користувачів:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
}


