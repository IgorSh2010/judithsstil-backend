export const requireRole = async (req, res, next) => {
  try {
    const client = req.dbClient;
    if (!client) {
      return res.status(500).json({ message: "DB client not found in request" });
    }

    const userID = req.user?.id;
    if (!userID) {
      return res.status(401).json({ message: "Unauthorized: missing user id" });
    }

    const result = await client.query(
      "SELECT role FROM public.users WHERE id = $1",
      [userID]
    );

    const role = result.rows[0]?.role;

    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden: admin only" });
    }

    next();

  } catch (err) {
    console.error("❌ Помилка при перевірці ролі:", err);
    return res.status(500).json({ message: "Помилка сервера", error: err.message });
  }
};
