export const requireRole = (role) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "No user" });
    // приклад: user може містити claim x-hasura-default-role або role
    if (user["https://hasura.io/jwt/claims"]?.["x-hasura-default-role"] === role
        || user.role === role
        || user.default_role === role) {
      return next();
    }
    return res.status(403).json({ message: "Недостатньо прав" });
  };
};