import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const { Pool } = pkg;
const pool = new Pool({
  user: "dbadmin",
  host: "localhost",   // якщо Express теж на сервері
  database: "maindatabase",
  password: "Igor2025",
  port: 5433,
});

// Секретний ключ для підпису токенів (пізніше можна винести в .env)
const JWT_SECRET = "super_secret_key"; 
const JWT_EXPIRES_IN = "1h"; // термін дії токена

// Реєстрація
export const register = async (req, res) => {
  const { email, password } = req.body; 

  if (!email || !password) {
      return res.status(400).json({ message: "Email і пароль обов’язкові" });
    }
  
  try {
    // Перевірка, чи існує вже юзер
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
    return res.status(400).json({ message: "Użytkownik z takim email już istnieje!" });
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Додавання користувача
    const result = await pool.query(
    `INSERT INTO users (email, password) 
        VALUES ($1, $2) RETURNING id, email, created_at`,
    [email, hashedPassword]
    );

    res.status(201).json({
    message: "Реєстрація успішна",
    user: result.rows[0],
    });

    } catch (err) {
      console.error("Błąd pod czas rejestracji:", err);
      res.status(500).json({ message: "Wewnętrny błąd serwera" });
    }
  };

// Логін
export const login = async (req, res) => {
  const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email і пароль обов’язкові" });
        }
    try {
      // Знаходження юзера
      const userResult = await pool.query("SELECT id, email, password FROM users WHERE email = $1", [email]);
      if (userResult.rows.length === 0) {
        return res.status(400).json({ message: "Невірний email або пароль" });
      }
        const user = userResult.rows[0];
        // Перевірка пароля
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
          return res.status(400).json({ message: "Невірний email або пароль" });
        }

        // Генерація токена
        const token = jwt.sign(
            { id: user.id, email: user.email }, // payload
            JWT_SECRET,                         // секретний ключ
            { expiresIn: JWT_EXPIRES_IN }       // термін дії
        );

        // Якщо все ок, повертаємо дані юзера (токен можна додати пізніше)
        res.json({
          message: "Логін успішний",
            token,
          user: { id: user.id, email: user.email },
        });
    } catch (err) {
      console.error("Błąd pod czas logowania:", err);
      res.status(500).json({ message: "Wewnętrny błąd serwera" });
    }
    };

