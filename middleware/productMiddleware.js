//Додаткова функція для створення/вибору категорій
export const getCategory = async (client, category) => {
  const categoryName = category.trim();
  const catCheck = await client.query(
    `SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1)`,
    [categoryName]
  );

  if (catCheck.rows.length > 0) {
    const categoryId = catCheck.rows[0].id;
    return categoryId;
  } else {
    const newCat = await client.query(
      `INSERT INTO product_categories (name, slug) VALUES ($1, LOWER($1)) RETURNING id`,
      [categoryName]
    );
    const categoryId = newCat.rows[0].id;
    return categoryId;
  }  
};

// 🔸 Обробка sizes (Postgres array)
export const setSizes = (sizes) => {
  console.log("sizes", sizes, typeof sizes);
  if (Array.isArray(sizes)) {
    return `{${sizes.map(s => `"${s}"`).join(",")}}`;
  } else {
    return `{${sizes}}`;
  }
};