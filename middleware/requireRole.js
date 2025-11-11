export const requireRole = async (role) => {
  return async (req, res, next) => {
    const userID = req.user.id;
    const result = await client.query(
      "SELECT role FROM public.users WHERE id = $1",
      [userID]
    );

    if (result.rows[0].role !== role) {
      return res.status(403).json({ message: "Forbidden" }); // 403 Forbidden
    }
    next();
  };
};