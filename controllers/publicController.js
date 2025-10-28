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

export const getProducts = async (req, res) => {  
  try {
    const query = `
      SELECT p.id, p.title as name, p.description, p.price, pc.name as category, p.is_available,
        COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM judithsstil.products p
      LEFT JOIN judithsstil.product_images pi ON p.id = pi.product_id
      LEFT JOIN judithsstil.product_categories pc ON p.category_id = pc.id
      GROUP BY p.id
      ORDER BY p.created_at DESC;
    `;
    const result = await pool.query(query);
    const products = result.rows.map((p) => ({
      ...p,
      images: typeof p.images === "string" ? JSON.parse(p.images) : p.images
    }));
    res.json(products);
  } catch (err) {
    console.error("❌ Błąd pobierania produktów:", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};