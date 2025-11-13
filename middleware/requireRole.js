export const requireRole = async (req, res, next) => {
  try { 
      const client = req.dbClient; 
      const userID = req.user.id;
      const result = await client.query(
        "SELECT role FROM public.users WHERE id = $1",
        [userID]
      );

      if (result.rows[0].role !== "admin") {
        return res.status(403).json({ message: "Forbidden" }); // 403 Forbidden
      }
      next();
    } catch (err) {
      console.error("❌ Помилка при перевірці ролі користувача:", err);
      res.status(500).json({ message: "Помилка сервера", error: err.message });
    } finally {
      client.release(); // <-- обов’язково!
    }
  };
