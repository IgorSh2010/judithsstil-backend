import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";

const app = express();

app.use(cors());
app.use(express.json());

// Маршрути
app.use("/auth", authRoutes);
app.use("/users", userRoutes);

//Тестовий роут
app.get("/", (req, res) => {
  res.send("Backend API працює ✅");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
