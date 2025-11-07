import dotenv from "dotenv";
import { getClientPool } from "../middleware/ClientPool.js";
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
  const client = await getClientPool();

  if (!email || !password) {
      return res.status(400).json({ message: "Nie wypełnione Email lub hasło" });
    }
  
  try {
    // Перевірка, чи існує вже юзер
    const existing = await client.query("SELECT id FROM users WHERE email = $1 AND tenant = $2", [email, tenant]);
    if (existing.rows.length > 0) {
    return res.status(400).json({ message: "Użytkownik z takim email już istnieje!" });
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Додавання користувача
    const result = await client.query(
    `INSERT INTO users (email, password, tenant) 
        VALUES ($1, $2, $3) RETURNING id, email, created_at`,
    [email, hashedPassword, tenant]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    await client.query(
          `INSERT INTO user_refresh_tokens (user_id, token, user_agent, ip_address, expires_at)
          VALUES ($1, $2, $3, $4, NOW() + interval '3 days')`,
          [user.id, refreshToken, userAgent, ip]
        );

        // 🔹 Установка refreshToken у HttpOnly cookie
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,       // ❌ недоступна з JavaScript
          secure: true,         // ✅ тільки HTTPS
          sameSite: "none",   // ✅ надсилається на інші домени
          maxAge: 3 * 24 * 60 * 60 * 1000, // 3 дні
        });

    res.status(201).json({
    message: "Rejestracja udana!",
    user: result.rows[0],
    token,
    });

    } catch (err) {
      console.error("Błąd pod czas rejestracji:", err);
      res.status(500).json({ message: "Wewnętrny błąd serwera" });
    } finally {
      client.release(); // <-- обов’язково!
    }
  };

// Autoryzacja (logowanie)
export const login = async (req, res) => {
  const { email, password, tenant } = req.body;
  const client = await getClientPool();

    if (!email || !password) {
        return res.status(400).json({ message: "Nie wypełnione Email lub hasło" });
        }

    try {
      // Знаходження юзера
      const userResult = await client.query("SELECT id, email, tenant, password FROM users WHERE email = $1 AND tenant = $2", [email, tenant]);
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
        await client.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
        await client.query(
          `INSERT INTO user_logins (user_id, ip_address, user_agent)
           VALUES ($1, $2, $3)`,
          [user.id, ip, userAgent]
        );

        await client.query(
          `INSERT INTO user_refresh_tokens (user_id, token, user_agent, ip_address, expires_at)
          VALUES ($1, $2, $3, $4, NOW() + interval '3 days')`,
          [user.id, refreshToken, userAgent, ip]
        );

        // 🔹 Установка refreshToken у HttpOnly cookie
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,       // ❌ недоступна з JavaScript
          secure: true,         // ✅ тільки HTTPS
          sameSite: "none",   // ✅ надсилається на інші домени
          maxAge: 3 * 24 * 60 * 60 * 1000, // 3 дні
        });

        // Якщо все ок, повертаємо дані юзера і токен
        res.json({
          message: "Użytkownik zalogowany!",
          token,
          user: { id: user.id, email: user.email, name: user.username, role: user.role },
        });
    } catch (err) {
      console.error("Błąd pod czas logowania:", err);
      res.status(500).json({ message: "Wewnętrny błąd serwera - login" });
    } finally {
      client.release();
    }
 };

// 👤 Перевірка авторизації (опціонально)
export const getProfile = async (req, res) => {
   const client = await getClientPool();
    try {
      // user додається через middleware після перевірки токена
      const userId = req.user.id;
  
      const result = await client.query("SELECT id, email, created_at FROM users WHERE id = $1", [userId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Користувача не знайдено" });
      }
  
      res.json(result.rows[0]);
    } catch (err) {
      console.error("❌ Помилка при отриманні профілю:", err);
      res.status(500).json({ message: "Внутрішня помилка сервера" });
    } finally {
      client.release(); // <-- обов’язково!
    }
};

  // === REFRESH ===
export const refreshToken = async (req, res) => {
  const client = await getClientPool();
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({ message: "Brak refresh tokena w ciasteczkach" });
    }

    // Перевірка refresh токена (чи справжній)
    const decoded = jwt.verify(token, process.env.REFRESH_JWT_SECRET);

    // Перевірка чи токен існує у БД (тобто не відкликаний)
    const result = await client.query(
      `SELECT urt.token, u.id, u.email, u.tenant, u.username, u.role
       FROM user_refresh_tokens urt
       JOIN users u ON urt.user_id = u.id
       WHERE urt.token = $1 AND urt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ message: "Refresh token nieważny lub wygasł" });
    }

    const user = result.rows[0];

    // Генеруємо новий короткоживучий токен доступу (accessToken)
    const newAccessToken = generateToken(user);

    res.json({ token: newAccessToken });
  } catch (err) {
    console.error("❌ Błąd podczas odświeżania tokena:", err);
    res.status(401).json({ message: "Nieprawidłowy refresh token" });
  } finally {
    client.release(); // <-- обов’язково!
  }
};

// === LOGOUT ===
export const logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const client = await getClientPool();

  if (!refreshToken) {
    return res.status(400).json({ message: "Brak tokena odświeżającego" });
  }
  try {
    // Видалення refresh токена з бази
    await client.query("DELETE FROM user_refresh_tokens WHERE token = $1", [refreshToken]);
    res.clearCookie("refreshToken");
    res.json({ message: "Wylogowano pomyślnie" });
  } catch (err) {
    console.error("Błąd pod czas wylogowania:", err);
    res.status(500).json({ message: "Wewnętrzny błąd serwera - logout" });
  } finally {
    client.release();
  }
};
