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
    if (!file) {
    return res.status(400).json({ message: "Brak pliku do wgrania." });
  }
    try {
    // Отримання старого public_id для видалення (якщо потрібно)
     const oldImageQuery = `
      SELECT ${type}_public_id AS public_id
      FROM settings
      WHERE user_id = $1;
    `;
    const oldImageResult = await client.query(oldImageQuery, [userId]);
    const oldPublicId = oldImageResult.rows[0]?.public_id;

    // Збереження URL у базі
    const insertImageQuery = `
      INSERT INTO settings (user_id, ${type}_url, ${type}_public_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id)
      DO UPDATE SET
        ${type}_url = EXCLUDED.${type}_url,
        ${type}_public_id = EXCLUDED.${type}_public_id,
        updated_at = NOW()
      RETURNING ${type}_url AS image_url;
    `;

    // Завантаження фото на Cloudinary
    const shortName = uuidv4().slice(0, 18);
    const uploadResult = await cloudinary.uploader.upload(file.path, {  
        folder: `assets/${userId}/`,
        public_id: shortName, // Cloudinary сам додасть розширення
        resource_type: "image",
    });

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
    
    res.json({
      message: "Obraz pomyślnie wgrany!",
      imageUrl: result.rows[0].image_url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Błąd serwera podczas wgrywania obrazu." });
  } finally {
    client.release();
  } 
}; 

export const getImage = async (req, res) => {
  const client = req.dbClient;
   
  try {
    const { rows } = await client.query("SELECT banner_url, logo_url FROM settings where banner_url is not null and logo_url is not null LIMIT 1");
    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

