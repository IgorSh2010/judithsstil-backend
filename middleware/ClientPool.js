import { pool } from "./dbConn.js";

// Допоміжна функція для отримання клієнта з пулу
export async function getClientPool() {
  const client = await pool.connect();
  return client;
}