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
  const fields = req.body; // тут можуть бути будь-які поля, що змінюються

  try {
    if (!productId) {
      return res.status(400).json({ message: "Brak ID produktu" });
    }

    // якщо нічого не передано — повертаємо помилку
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ message: "Brak danych do aktualizacji" });
    }

    let categoryId = null;

    // 🔸 якщо прийшла категорія як назва
    if (fields.category) {
      const categoryName = fields.category.trim();

      // Перевіряємо, чи така категорія вже є
      const catCheck = await client.query(
        `SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1)`,
        [categoryName]
      );

      if (catCheck.rows.length > 0) {
        categoryId = catCheck.rows[0].id; // існує
      } else {
        // Створюємо нову категорію
        const newCat = await client.query(
          `INSERT INTO product_categories (name, slug) VALUES ($1,LOWER($1)) RETURNING id`,
          [categoryName]
        );
        categoryId = newCat.rows[0].id;
      }

      // замінюємо у оновленнях category → category_id
      delete fields.category;
      fields.category_id = categoryId;
    }

    if (fields.sizes && Array.isArray(fields.sizes)) {
      fields.sizes = `{${fields.sizes.map(s => `"${s}"`).join(",")}}`;
    }

    // 🔸 Масиви для динамічного складання SQL
    const setClauses = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (key === "images") continue; // зображення оновлюємо окремо нижче

      // спец. випадок для sizes → JSON.stringify()
      if (key === "sizes" && Array.isArray(value)) {
        setClauses.push(`${key} = $${index}`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${key} = $${index}`);
        values.push(value);
      }
      index++;
    }

    // 🔸 Якщо нічого не змінюється — вихід
    if (setClauses.length === 0 && !fields.images) {
      return res.status(400).json({ message: "Brak zmian do zapisania" });
    }

    // 🔸 Оновлюємо тільки змінені поля
    const query = `
      UPDATE products
      SET ${setClauses.join(", ")},
          updated_at = NOW() 
      WHERE id = $${index}
      RETURNING *;
    `;
    values.push(productId);

    const result = await client.query(query, values);

    // 🔸 (опціонально) якщо оновлюємо зображення
    // Завантажуємо фото на Cloudinary
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

    // Зберігаємо URL у базі
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

    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error("❌ Błąd aktualizacji produktu:", err);
    res.status(500).json({ message: "Błąd serwera" });
  }
};

