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
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: `products/${productId}`,
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
