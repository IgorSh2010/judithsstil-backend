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