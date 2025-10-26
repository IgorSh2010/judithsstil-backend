import dotenv from "dotenv";
import { pool } from "../middleware/dbConn.js";

dotenv.config();

export const getLogo = async (req, res) => {
  const client = req.dbClient;
  console.log("Fetching logo for tenant:", req);

  try {
    const query = `
      SELECT logo_url AS logoUrl  
      FROM judithsstil.settings
      WHERE logo_url IS NOT NULL;
    `;
    const result = await client.query(query);
    if (result.rows.length === 0 || !result.rows[0].logourl) {
      return NULL;
    }
    res.json({ logoUrl: result.rows[0].logourl });
  } catch (err) {
    console.error("Błąd podczas pobierania logo:", err);
    res.status(500).json({ message: "Błąd serwera podczas pobierania logo." });
  }
};