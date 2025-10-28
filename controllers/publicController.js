import dotenv from "dotenv";
import { pool } from "../middleware/dbConn.js";

dotenv.config();

export const getLogo = async (req, res) => {
  //В цій змінній зберігається домен орігін запиту по якому можна визначити тенанта
  //для майбутніх змін коли лого буде зберігатися в різних схемах
  //const host = req.get('origin');
  //console.log("Fetching logo for tenant:", host);

  try {
    const query = `
      SELECT logo_url AS logoUrl  
      FROM judithsstil.settings
      WHERE logo_url IS NOT NULL;
    `;
    const result = await pool.query(query);
    if (result.rows.length === 0 || !result.rows[0].logourl) {
      return NULL;
    }
    res.json({ logoUrl: result.rows[0].logourl });
  } catch (err) {
    console.error("Błąd podczas pobierania logo:", err);
    res.status(500).json({ message: "Błąd serwera podczas pobierania logo." });
  }
};

export const getBanner = async (req, res) => {
  try {
    const query = ` 
        SELECT banner_url AS bannerUrl
        FROM judithsstil.settings
        WHERE banner_url IS NOT NULL;
      `;
    const result = await pool.query(query);
    if (result.rows.length === 0 || !result.rows[0].bannerurl) {
      return NULL;
    }   
    res.json({ bannerUrl: result.rows[0].bannerurl });
    } catch (err) {
        console.error("Błąd podczas pobierania banera:", err);
        res.status(500).json({ message: "Błąd serwera podczas pobierania banera." });
    }
};

export const getCategories = async (req, res) => {
  try {
    const query = ` 
        SELECT id, name, slug
        FROM judithsstil.product_categories;
      `;
    const result = await pool.query(query);
    if (result.rows.length === 0 || !result.rows[0].name) {
      return NULL;
    }   
    res.json({ id: result.rows[0].id, name: result.rows[0].name, slug: result.rows[0].slug });
    } catch (err) {
        console.error("Błąd podczas pobierania kategorji:", err);
        res.status(500).json({ message: "Błąd serwera podczas pobierania kategorji." });
    }
};