import express from "express";
import cors from "cors";
//import authRoutes from "./routes/auth.js"; 
import userRoutes from "./routes/users.js";

/*
🔹 server.js — тільки точка входу: підняти Express, підключити middleware, маршрути, запустити сервер.
🔹 routes/ — окремі файли для груп ендпойнтів (наприклад auth.js, users.js, products.js).
🔹 controllers/ — бізнес-логіка для кожного ендпойнту (щоб код не був у 5 рівнів вкладеності).
🔹 models/ — доступ до БД (SQL-запити, ORM-моделі, як хочеш).
🔹 middleware/ — наприклад, перевірка JWT чи логування.
*/

const app = express();
app.use(cors());
app.use(express.json());

// Маршрути 
//app.use("/auth", authRoutes); 
app.use("/users", userRoutes);

// 🔹 Тестовий роут
app.get("/", (req, res) => {
  res.send("Backend API працює ✅");
});

// 🔹 Запуск сервера
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend API слухає на порту ${PORT}`);
});
