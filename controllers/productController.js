import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
//import { pool } from "../middleware/dbConn.js";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const createProduct = async (req, res) => {
  const client = req.dbClient;
  const { name, description, price } = req.body;
  const files = req.files;

  if (!name || !price) {
    return res.status(400).json({ message: "Brak wymaganych danych." });
  }

  try {
    // 1️⃣ Створюємо сам товар
    const queryProduct = `
      INSERT INTO products (title, description, price)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const result = await client.query(queryProduct, [name, description || "", price]);
    const productId = result.rows[0].id;

    // 2️⃣ Завантажуємо фото на Cloudinary
    const uploadedUrls = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const shortName = uuidv4().slice(0, 10); // типу "f2a4c1e8b9"
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: `products/${productId}`,
          public_id: shortName, // Cloudinary сам додасть розширення
          resource_type: "image",
        });
        uploadedUrls.push(uploadResult.secure_url);
        fs.unlinkSync(file.path); // видалення тимчасового файлу
      }
    }

    // 3️⃣ Зберігаємо URL у базі
    if (uploadedUrls.length > 0) {
      const insertImageQuery = `
        INSERT INTO product_images (product_id, image_url)
        VALUES ${uploadedUrls.map((_, i) => `($1, $${i + 2})`).join(", ")}
      `;
      await client.query(insertImageQuery, [productId, ...uploadedUrls]);
    }

    res.status(201).json({
      message: "Produkt pomyślnie dodany!",
      product: { id: productId, name, price, images: uploadedUrls },
    });
  } catch (err) {
    console.error("❌ Błąd dodawania produktu:", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};

export const getProducts = async (req, res) => {
  const client = req.dbClient;  
  try {
    const query = `
      SELECT p.id, p.title, p.description, p.price, p.is_available,
        COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      GROUP BY p.id
      ORDER BY p.created_at DESC;
    `;
    const result = await client.query(query);
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

export const changeAvailability = async (req, res) => {
  const client = req.dbClient;
  const productId = req.params.id;
  const { available } = req.body; 

  try {
    const query = `
      UPDATE products 
      SET is_available = $1,
          updated_at = NOW() 
      WHERE id = $2
      RETURNING id, is_available;
    `;
    const result = await client.query(query, [available, productId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Produkt nie znaleziony." });
    } 

    res.json({
      message: "Dostępność produktu zaktualizowana.",
      product: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Błąd zmiany dostępności produktu:", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};

export const deleteProduct = async (req, res) => {
  const client = req.dbClient;
  const productId = req.params.id;
  try {
    // Видаляємо зображення з Cloudinary
    const imageQuery = `SELECT image_url FROM product_images WHERE product_id = $1`;
    const imageResult = await client.query(imageQuery, [productId]);
    for (const row of imageResult.rows) {
      const publicId = row.image_url.split("/").slice(-2).join("/").split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }
    // Видаляємо записи з product_images
    await client.query(`DELETE FROM product_images WHERE product_id = $1`, [productId]);

    // Видаляємо сам продукт
    const deleteQuery = `DELETE FROM products WHERE id = $1 RETURNING id;`;
    const deleteResult = await client.query(deleteQuery, [productId]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ message: "Produkt nie znaleziony." });
    }

    res.json({ message: "Produkt usunięty pomyślnie." });

  } catch (err) {
    console.error("❌ Błąd usuwania produktu:", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};
