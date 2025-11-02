import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
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
  const uploaded = [];

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
    if (files && files.length > 0) {
      for (const file of files) {
        const shortName = uuidv4().slice(0, 18); // типу "f2a4c1e8b9"
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: `products/${productId}`,
          public_id: shortName, // Cloudinary сам додасть розширення
          resource_type: "image",
        });

        uploaded.push({
                            url: uploadResult.secure_url,
                            public_id: uploadResult.public_id,
                          });
        fs.unlinkSync(file.path); // видалення тимчасового файлу
      }
    }

    // 3️⃣ Зберігаємо URL у базі
    if (uploaded.length > 0) {
      const insertImageQuery = `
        INSERT INTO product_images (product_id, image_url, public_id)
        VALUES ${uploaded.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ")} 
      `;

      const params = [productId];
      uploaded.forEach((img) => {
        params.push(img.url, img.public_id);
      });
      
      await client.query(insertImageQuery, params);
    }

    res.json({
      message: "Produkt pomyślnie dodany!",
      //product: { id: productId, name, price, images: uploadedUrls },
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
      SELECT p.id, p.title, p.description, p.price, p.is_available, p.is_bestseller, p.is_featured,
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

export const deleteProduct = async (req, res) => {
  const client = req.dbClient;
  const productId = req.params.id;
  try {
    // Видаляємо зображення з Cloudinary
    const imageQuery = `SELECT image_url, public_id FROM product_images WHERE product_id = $1`;
    const imageResult = await client.query(imageQuery, [productId]);
    for (const row of imageResult.rows) {
      if (row.public_id) {
        await cloudinary.uploader.destroy(row.public_id);
      }
    }
    await cloudinary.api.delete_folder(`products/${productId}`);
    
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

export const updateProduct = async (req, res) => {
  const client = req.dbClient;
  const productId = req.params.id;
  const fields = req.body;
  const files = req.files;
  if (req.body.removedImages) {
    try {
      req.body.removedImages = JSON.parse(req.body.removedImages);
    } catch {
      req.body.removedImages = [];
    }
  }
  
  try {
    if (!productId) {
      return res.status(400).json({ message: "Brak ID produktu" });
    }

    // Якщо взагалі нічого не передано
    if (!fields && (!files || files.length === 0)) {
      return res.status(400).json({ message: "Brak danych do aktualizacji" });
    }

    let categoryId = null;

    // 🔸 Якщо прийшла категорія як назва — шукаємо або створюємо
    if (fields.category) {
      const categoryName = fields.category.trim();
      const catCheck = await client.query(
        `SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1)`,
        [categoryName]
      );

      if (catCheck.rows.length > 0) {
        categoryId = catCheck.rows[0].id;
      } else {
        const newCat = await client.query(
          `INSERT INTO product_categories (name, slug) VALUES ($1, LOWER($1)) RETURNING id`,
          [categoryName]
        );
        categoryId = newCat.rows[0].id;
      }

      delete fields.category;
      fields.category_id = categoryId;
    }

    // 🔸 Обробка sizes (Postgres array)
    if (fields.sizes && Array.isArray(fields.sizes)) {
      fields.sizes = `{${fields.sizes.map(s => `"${s}"`).join(",")}}`;
    }

    // 🔸 Динамічне формування SQL
    const setClauses = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (key === "images" || key === "removedImages") continue; // ці поля обробляються окремо
      setClauses.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }

    // 🔸 Якщо є поля для оновлення — робимо UPDATE
    let result = { rows: [] };
    if (setClauses.length > 0) {
      const query = `
        UPDATE products
        SET ${setClauses.join(", ")},
            updated_at = NOW()
        WHERE id = $${index}
        RETURNING *;
      `;
      values.push(productId);
      result = await client.query(query, values);
    }

    // 🔸 Завантаження нових зображень
    const uploaded = [];
    if (files && files.length > 0) {
      const uploadPromises = files.map(async (file) => {
        const shortName = uuidv4().slice(0, 18);
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: `products/${productId}`,
          public_id: shortName,
          resource_type: "image",
        });
        fs.unlinkSync(file.path);
        return {
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        };
      });

      const uploadedResults = await Promise.all(uploadPromises);
      uploaded.push(...uploadedResults);

      if (uploaded.length > 0) {
        const insertImageQuery = `
          INSERT INTO product_images (product_id, image_url, public_id)
          VALUES ${uploaded.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ")}
        `;
        const params = [productId];
        uploaded.forEach(img => params.push(img.url, img.public_id));
        await client.query(insertImageQuery, params);
      }
    }

    // 🔸 Видалення зображень
    if (fields.removedImages && Array.isArray(fields.removedImages) && fields.removedImages.length > 0) {
      for (const img of fields.removedImages) {
        try {
          await cloudinary.uploader.destroy(img.public_id);
          await client.query(`DELETE FROM product_images WHERE public_id = $1`, [img.public_id]);
        } catch (err) {
          console.warn(`⚠️ Nie udało się usunąć obrazu ${img.public_id}:`, err);
        }
      }
    }

    // 🔸 Повертаємо актуальний продукт
    const finalProduct =
      result.rows[0] ||
      (await client.query("SELECT * FROM products WHERE id = $1", [productId])).rows[0];

    res.json({ success: true, product: finalProduct });
  } catch (err) {
    console.error("❌ Błąd aktualizacji produktu:", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};

