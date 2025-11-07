import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

// const tenants = {
//   lsstudio: new Pool({ user: process.env.DB_LS_USER, password: process.env.DB_LS_PASSWORD,  host: process.env.DB_HOST,  database: process.env.DB_NAME,  port: process.env.DB_PORT, }),
//   judithsstil: new Pool({ user: process.env.DB_JS_USER, password: process.env.DB_JS_PASSWORD,  host: process.env.DB_HOST,  database: process.env.DB_NAME,  port: process.env.DB_PORT,  })
// };

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 150,                  // максимум одночасних з’єднань
  idleTimeoutMillis: 20000, // через 20 секунд неактивності з’єднання закривається
});

// export function getTenantPool(tenant) {
//   return tenants[tenant] || tenants['judithsstil']
// }

pool.on("connect", () => {
  console.log("✅ Підключено до бази даних PostgreSQL з кількістю одночасних з'єднань:", pool.max);
});

pool.on("error", (err) => {
  console.error("❌ Помилка підключення до бази:", err);
});
