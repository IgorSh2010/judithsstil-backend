import jwt from "jsonwebtoken";

const JWT_SECRET = "super_secret_key"; // має збігатися з login

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // формат: "Bearer token"

  if (!token) {
    return res.status(401).json({ message: "Токен відсутній" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // тепер можна дістати req.user.id
    next();
  } catch (err) {
    return res.status(403).json({ message: "Невалідний або прострочений токен" });
  }
};
