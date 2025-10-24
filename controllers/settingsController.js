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
  const type = req.type;
  const userId = req.user.id;
    if (!file) {
    return res.status(400).json({ message: "Brak pliku do wgrania." });
  }
    try {
    // Завантаження фото на Cloudinary
    const shortName = uuidv4().slice(0, 18);
    const uploadResult = await cloudinary.uploader.upload(file.path, {  
        folder: `assets/${type}/`,
        public_id: shortName, // Cloudinary сам додасть розширення
        resource_type: "image",
    });
    fs.unlinkSync(file.path); // видалення тимчасового файлу

    // Збереження URL у базі
    const insertImageQuery = `
      INSERT INTO settings (user_id, ${type}_url, public_id, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        ${type}_url = EXCLUDED.${type}_url,
        public_id = EXCLUDED.public_id,
        updated_at = NOW()
      RETURNING ${type}_url AS image_url;
    `;
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
  } 
}; 