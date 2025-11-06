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
      return res.status(404).json({ message: "Brak ścieżki do logo" });
    }
    res.json({ logoUrl: result.rows[0].logourl });
  } catch (err) {
    console.error("Błąd podczas pobierania logo:", err);
    res.status(500).json({ message: "Błąd serwera podczas pobierania logo." });
  } finally {
      pool.release(); // ← обов’язково
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
      return res.status(404).json({ message: "Brak ścieżki do banera" });
    }   
    res.json({ bannerUrl: result.rows[0].bannerurl });
    } catch (err) {
        console.error("Błąd podczas pobierania banera:", err);
        res.status(500).json({ message: "Błąd serwera podczas pobierania banera." });
    } finally {
      pool.release(); // ← обов’язково
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
      return res.status(404).json({ message: "Brak kategorji" });
    }   
    res.json(result);
    } catch (err) {
        console.error("Błąd podczas pobierania kategorji:", err);
        res.status(500).json({ message: "Błąd serwera podczas pobierania kategorji." });
    } finally {
      pool.release(); // ← обов’язково
    }
};

export const getProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.query; // ✅ додаємо query параметр
  
    let products;

    // --- 🔹 Якщо запит з ID — повертаємо конкретний продукт
    if (id) {
      const query = `
        SELECT 
          p.id, 
          p.title AS name, 
          p.description, 
          p.price, 
          pc.name AS category, 
          pc.slug AS category_slug,
          p.is_available, 
          p.is_bestseller,
          p.is_featured,
          p.sizes,
          COALESCE(
            json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), 
            '[]'
          ) AS images
        FROM judithsstil.products p
        LEFT JOIN judithsstil.product_images pi ON p.id = pi.product_id
        LEFT JOIN judithsstil.product_categories pc ON p.category_id = pc.id
        WHERE p.id = $1
        GROUP BY p.id, pc.name, pc.slug
        ORDER BY p.created_at DESC;
      `;
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Produkt nie znaleziony" });
      }

      const product = result.rows[0];
      product.images =
        typeof product.images === "string"
          ? JSON.parse(product.images)
          : product.images;

      return res.json(product);
    }

    // --- 🔹 Якщо є фільтр по категорії
    let query;
    let values = [];

    if (category && category !== "all") {
      query = `
        SELECT 
          p.id, 
          p.title AS name, 
          p.description, 
          p.price, 
          pc.name AS category, 
          pc.slug AS category_slug,
          p.is_available, 
          p.is_bestseller,
          p.is_featured,
          p.sizes,
          COALESCE(
            json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), 
            '[]'
          ) AS images
        FROM judithsstil.products p
        LEFT JOIN judithsstil.product_images pi ON p.id = pi.product_id
        LEFT JOIN judithsstil.product_categories pc ON p.category_id = pc.id
        WHERE pc.slug = $1
        GROUP BY p.id, pc.name, pc.slug
        ORDER BY p.created_at DESC;
      `;
      values = [category];
    } else {
      // --- 🔹 Без фільтра: всі продукти
      query = `
        SELECT 
          p.id, 
          p.title AS name, 
          p.description, 
          p.price, 
          pc.name AS category, 
          pc.slug AS category_slug,
          p.is_available, 
          p.is_bestseller,
          p.is_featured,
          p.sizes,
          COALESCE(
            json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), 
            '[]'
          ) AS images
        FROM judithsstil.products p
        LEFT JOIN judithsstil.product_images pi ON p.id = pi.product_id
        LEFT JOIN judithsstil.product_categories pc ON p.category_id = pc.id
        GROUP BY p.id, pc.name, pc.slug
        ORDER BY p.created_at DESC;
      `;
    }

    const result = await pool.query(query, values);
    products = result.rows.map((p) => ({
      ...p,
      images: typeof p.images === "string" ? JSON.parse(p.images) : p.images,
    }));

    res.json(products);
  } catch (err) {
    console.error("❌ Błąd pobierania produktów:", err);
    res.status(500).json({ message: "Błąd serwera" });
  } finally {
      pool.release(); // ← обов’язково
    }
};

export const getTest = async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time;")
    res.json({
      message: "✅ Connected to PostgreSQL!",
      time: result.rows[0].current_time,
    })
  } catch (err) {
    console.error("❌ Database connection error:", err)
    res.status(500).json({ error: "Database connection failed", details: err.message })
  } finally {
      pool.release(); // ← обов’язково
    }
};

