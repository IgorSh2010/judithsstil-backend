import dotenv from "dotenv";
import { pool } from "../middleware/dbConn.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

//Допоміжна функція для створення токена
const generateToken = (user) => {  
  return jwt.sign(
    { id: user.id,
      email: user.email,
      tenant: user.tenant,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
};

const generateRefreshToken = (user) => {  
  return jwt.sign(
    { id: user.id,
      email: user.email,
      tenant: user.tenant,
    },
    process.env.REFRESH_JWT_SECRET,
    { expiresIn: process.env.REFRESH_JWT_EXPIRES_IN || "3d" }
  );
};

// Реєстрація
export const register = async (req, res) => {
  const { email, password, tenant } = req.body; 

  if (!email || !password) {
      return res.status(400).json({ message: "Nie wypełnione Email lub hasło" });
    }
  
  try {
    // Перевірка, чи існує вже юзер
    const existing = await pool.query("SELECT id FROM users WHERE email = $1 AND tenant = $2", [email, tenant]);
    if (existing.rows.length > 0) {
    return res.status(400).json({ message: "Użytkownik z takim email już istnieje!" });
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Додавання користувача
    const result = await pool.query(
    `INSERT INTO users (email, password, tenant) 
        VALUES ($1, $2, $3) RETURNING id, email, created_at`,
    [email, hashedPassword, tenant]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    res.status(201).json({
    message: "Rejestracja udana!",
    user: result.rows[0],
    token,
    refreshToken,
    });

    } catch (err) {
      console.error("Błąd pod czas rejestracji:", err);
      res.status(500).json({ message: "Wewnętrny błąd serwera" });
    }
  };

// Autoryzacja (logowanie)
export const login = async (req, res) => {
  const { email, password, tenant } = req.body;
  console.log("Login attempt:", email, tenant, req.body);

    if (!email || !password) {
        return res.status(400).json({ message: "Nie wypełnione Email lub hasło" });
        }

    try {
      // Знаходження юзера
      const userResult = await pool.query("SELECT id, email, tenant, password FROM users WHERE email = $1 AND tenant = $2", [email, tenant]);
      if (userResult.rows.length === 0) {
        return res.status(400).json({ message: "Email lub hasło nie prawidłowe lub użytkownik nie zarejestrowany!" });
      }
        const user = userResult.rows[0];
        // Перевірка пароля
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
          return res.status(400).json({ message: "Email lub hasło nie prawidłowe" });
        }

        // Генерація токена
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        // Отримати IP і User-Agent
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const userAgent = req.headers["user-agent"];

        // Оновити last_login і додати запис в user_logins
        await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
        await pool.query(
          `INSERT INTO user_logins (user_id, ip_address, user_agent)
           VALUES ($1, $2, $3)`,
          [user.id, ip, userAgent]
        );

        await client.query(
          `INSERT INTO user_refresh_tokens (user_id, token, user_agent, ip_address, expires_at)
          VALUES ($1, $2, $3, $4, NOW() + interval '3 days')`,
          [user.id, refreshToken, userAgent, ip]
        );

        // Якщо все ок, повертаємо дані юзера і токен
        res.json({
          message: "Użytkownik zalogowany!",
          token,
          refreshToken,
          user: { id: user.id, email: user.email, name: user.username, role: user.role },
        });
    } catch (err) {
      console.error("Błąd pod czas logowania:", err);
      res.status(500).json({ message: "Wewnętrny błąd serwera - login" });
    }
    };

// 👤 Перевірка авторизації (опціонально)
export const getProfile = async (req, res) => {
    try {
      // user додається через middleware після перевірки токена
      const userId = req.user.id;
  
      const result = await pool.query("SELECT id, email, created_at FROM users WHERE id = $1", [userId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Користувача не знайдено" });
      }
  
      res.json(result.rows[0]);
    } catch (err) {
      console.error("❌ Помилка при отриманні профілю:", err);
      res.status(500).json({ message: "Внутрішня помилка сервера" });
    };
};

  // === REFRESH ===
export const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Brak tokena odświeżającego" });
  }

  try {
      // Перевірка валідності refresh токена
      const payload = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET); 

      // Перевірка, чи існує такий refresh токен в базі
      const tokenResult = await pool.query(
        "SELECT id FROM user_refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()",
        [refreshToken, payload.id]
      );
      if (tokenResult.rows.length === 0) {
        return res.status(401).json({ message: "Nieprawidłowy token odświeżający" });
      } 
      // Генерація нового access токена
      const user = { id: payload.id, email: payload.email, tenant: payload.tenant };
      const newAccessToken = generateToken(user);
      res.json({ token: newAccessToken });
      } catch (err) {
        console.error("Błąd pod czas odświeżania tokena:", err);
        return res.status(401).json({ message: "Nieprawidłowy token odświeżający" });
      }  
};

// === LOGOUT ===
export const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Brak tokena odświeżającego" });
  }
  try {
    // Видалення refresh токена з бази
    await pool.query("DELETE FROM user_refresh_tokens WHERE refresh_token = $1", [refreshToken]);
    res.json({ message: "Wylogowano pomyślnie" });
  } catch (err) {
    console.error("Błąd pod czas wylogowania:", err);
    res.status(500).json({ message: "Wewnętrzny błąd serwera - logout" });
  } 
};


