import { v4 as uuidv4 } from "uuid";
import fs from "fs";

export const uploadProductImages = async (cloudinary, files, productId) => {
  const uploaded = [];

  for (const file of files) {
        const shortName = uuidv4().slice(0, 18); // типу "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
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

  return uploaded;
};
