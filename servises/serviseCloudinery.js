export const uploadProductImages = async (cloudinary, files, productId) => {
  const uploaded = [];

  for (const file of files) {
        const shortName = uuidv4().slice(0, 18); // типу ""
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
