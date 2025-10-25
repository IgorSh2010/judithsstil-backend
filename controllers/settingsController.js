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

export const uploadImage = async (req, res) => {
  const client = req.dbClient;
  const file = req.file;
  const type = req.body.type;
  const userId = req.user.id;
  console.log("Uploading image for user ID:", userId, "Type:", type);
    if (!file) {
    return res.status(400).json({ message: "Brak pliku do wgrania." });
  }
    try {
    // Отримання старого public_id для видалення (якщо потрібно)
     const oldImageQuery = `
      SELECT ${type}_public_id AS public_id
      FROM settings
      WHERE id = $1;
    `;
    const oldImageResult = await client.query(oldImageQuery, [userId]);
    const oldPublicId = oldImageResult.rows[0]?.public_id;

    // Збереження URL у базі
    console.log("Preparing to save image URL to database.");
    const insertImageQuery = `
      INSERT INTO settings (id, ${type}_url, ${type}_public_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET
        ${type}_url = EXCLUDED.${type}_url,
        ${type}_public_id = EXCLUDED.${type}_public_id,
        updated_at = NOW()
      RETURNING ${type}_url AS image_url;
    `;
    console.log("Insert Image Query:", insertImageQuery);
    console.log("Uploading file to Cloudinary:", file.path);

    // Завантаження фото на Cloudinary
    const shortName = uuidv4().slice(0, 18);
    const uploadResult = await cloudinary.uploader.upload(file.path, {  
        folder: `assets/${userId}/`,
        public_id: shortName, // Cloudinary сам додасть розширення
        resource_type: "image",
    });

      console.log("Upload Result:", uploadResult);

    fs.unlinkSync(file.path); // видалення тимчасового файлу

    if (oldPublicId) {
      // Видалення старого зображення з Cloudinary
      await cloudinary.uploader.destroy(oldPublicId);
    }

    const result = await client.query(insertImageQuery, [
      userId,
      uploadResult.secure_url,
      uploadResult.public_id,
    ]);
    console.log("Database insert result:", result.rows[0]);
    res.json({
      message: "Obraz pomyślnie wgrany!",
      imageUrl: result.rows[0].image_url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Błąd serwera podczas wgrywania obrazu." });
  } 
}; 

export const getLogo = async (req, res) => {
  const client = req.dbClient;

  try {
    const query = `
      SELECT logo_url AS logoUrl  
      FROM settings
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