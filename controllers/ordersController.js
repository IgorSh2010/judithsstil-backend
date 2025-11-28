export const getClientOrder = async (req, res) => {
    const { id } = req.params;
    const client = req.dbClient;
    try {
        if (id !== "main") {
            const orderQuery  = `SELECT o.*, 
                                c.id as conversation_id,
                                os.label as status_label  FROM orders o
                                left join order_statuses os 
                                    on o.status_id = os.id 
                                left JOIN conversations c 
                                    ON c.order_id = o.id
                                WHERE o.id = $1`;

            const orderResult = await client.query(orderQuery, [id]); 

            if (orderResult.rows.length === 0) {
                return res.status(404).json({ message: "Zamówienie nie znalezione." });
            }

            const order = orderResult.rows[0];

            const itemsQuery = `
                                SELECT 
                                oi.id,                                
                                p.id AS product_id,
                                p.title,
                                pi.image_url,
                                p.price AS product_price,
                                oi.quantity,
                                oi.price AS item_price,
                                (oi.quantity * oi.price) AS total_item
                                FROM order_items oi
                                left JOIN products p ON p.id = oi.product_id
                                left JOIN product_images pi ON pi.product_id = oi.product_id                    
                                WHERE oi.order_id = $1
                            `;
            const itemsResult = await client.query(itemsQuery, [id]);

            res.json({
                ...order,
                items: itemsResult.rows,
                history: null, //historyResult.rows,
                payment: null, //paymentResult.rows[0] || null,
            });

        } else {
            const result = await client.query(`SELECT o.*, os.label as status_label  FROM orders o
                                                left join order_statuses os 
                                                    on o.status_id = os.id 
                                                WHERE user_id = $1 ORDER BY o.created_at DESC`, [req.user.id]);
            res.json(result.rows);
        }
    } catch (error) {
        console.error("Błąd podczas pobierania zamówień:", error);
        res.status(500).json({ message: "Błąd serwera podczas pobierania zamówień." });
    } finally {
        client.release(); // <-- обов’язково!
    }
}

export const getClientCart = async (req, res) => {
    const client = req.dbClient;
    try {
        const result = await client.query(`SELECT ci.id, ci.product_id, ci.quantity, ci.price, p.title,
                                           COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
                                           FROM cart_items ci
                                           JOIN products p ON p.id = ci.product_id
                                           LEFT JOIN product_images pi ON pi.product_id = ci.product_id
                                           left join carts c on c.id = ci.cart_id
                                           WHERE c.user_id = $1 AND c.is_finished = false
                                           GROUP BY ci.id, ci.product_id, ci.quantity, ci.price, p.title`, [req.user.id]);
        
        const total = await client.query(`SELECT amount FROM carts 
                                          WHERE user_id = $1 AND is_finished = false`, [req.user.id]);                                   
        
        res.json({ amount: total.rows[0].amount, items: result.rows});
    } catch (error) {
        console.error("Błąd podczas pobierania koszyka:", error);
        res.status(500).json({ message: "Błąd serwera podczas pobierania koszyka." });
    } finally {
        client.release(); // <-- обов’язково!
    }
}

export const addToCart = async (req, res) => {
  const client = req.dbClient;
  const user_id = req.user?.id;
  const { productID, quantity, price } = req.body;

  if (!user_id || !productID || !quantity || !price) {
    return res.status(400).json({ message: "Brak wymaganych danych." });
  }

  try {
    await client.query("BEGIN");
    // 1️⃣ Створюємо (або отримуємо) кошик користувача
    const insertCart = `
      INSERT INTO carts (user_id, amount)
      VALUES ($1, 0)
      ON CONFLICT (user_id)
      DO NOTHING
      RETURNING id
    `;
    let result = await client.query(insertCart, [user_id]);

    let cartID;
    if (result.rows.length > 0) {
      cartID = result.rows[0].id;
    } else {
      // Якщо кошик уже існує
      const existing = await client.query(`SELECT id FROM carts WHERE user_id = $1 AND is_finished = false`, [user_id]);
      cartID = existing.rows[0].id;
    }

    // 2️⃣ Додаємо або оновлюємо товар у cart_items
    const insertItem = `
      INSERT INTO cart_items (cart_id, product_id, quantity, price)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (cart_id, product_id)
      DO UPDATE SET 
        quantity = cart_items.quantity + EXCLUDED.quantity,
        price = EXCLUDED.price
    `;
    await client.query(insertItem, [cartID, productID, quantity, price]);

    // 3️⃣ Перераховуємо суму кошика
    const updateAmount = `
      UPDATE carts
      SET amount = COALESCE((
        SELECT SUM(quantity * price) 
        FROM cart_items 
        WHERE cart_id = $1
      ), 0)
      WHERE id = $1 
      RETURNING amount
    `;
    const updated = await client.query(updateAmount, [cartID]);

    await client.query("COMMIT");

    res.json({
      message: "Produkt dodany do koszyka.",
      totalAmount: updated.rows[0].amount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
      console.error("Błąd podczas dodawania do koszyka:", error);
      res.status(500).json({ message: "Błąd serwera podczas dodawania koszyka." });
  } finally {
      client.release();
  }
};

export const clearCart = async (req, res) => {
  const client = req.dbClient;
  const user_id = req.user?.id;

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM cart_items 
                        WHERE cart_id = (SELECT id FROM carts
                                         WHERE user_id = $1 
                                         AND is_finished = false)`
                        , [user_id]);

    await client.query("COMMIT");
    res.json({ message: "Koszyk został wyczyszczony." });
  } catch (error) {
    await client.query("ROLLBACK");
      console.error("Błąd podczas czyszczenia koszyka:", error);
      res.status(500).json({ message: "Błąd serwera podczas czyszczenia koszyka." });
  } finally {
      client.release();
  }
};

export const removeCartItem = async (req, res) => {
  const client = req.dbClient;
  const user_id = req.user?.id;
  const productID = req.params.productID;

  if (!user_id || !productID) {
    return res.status(400).json({ message: "Brak wymaganych danych." });
  }

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM cart_items 
                        WHERE cart_id = (SELECT id FROM carts
                                         WHERE user_id = $1 
                                         AND is_finished = false)
                        AND product_id = $2`, [user_id, productID]);

    // Перераховуємо суму кошика
    const updateAmount = `
      UPDATE carts c
      SET amount = COALESCE((
        SELECT SUM(ci.quantity * ci.price)
        FROM cart_items ci
        WHERE ci.cart_id = c.id
      ), 0)
      WHERE c.user_id = $1 AND c.is_finished = false;`;

    await client.query(updateAmount, [user_id]);
    await client.query("COMMIT");

    res.json({ message: "Produkt usunięty z koszyka." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Błąd podczas usuwania produktu z koszyka:", error);
    res.status(500).json({ message: "Błąd serwera podczas usuwania produktu z koszyka." });
  } finally {
    client.release();
  }
};

export const createOrder = async (req, res) => {
  const client = req.dbClient;

  try {
    await client.query("BEGIN");
    const userId = req.user.id;
    const { items, total } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: "Brak produktów w zamówieniu" });

    // 1. Створюємо саме замовлення
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total_price, status_id)
       VALUES ($1, $2, 1)
       RETURNING id`,
      [userId, total]
    );

    const orderId = orderResult.rows[0].id;

    // 2. Додаємо order_items
    const insertItems = items.map((it) =>
      client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, it.product_id, it.quantity, it.price]
      )
    );

    // 3. Створюємо розмову між користувачем та адміном до цього замовлення
    await client.query(
      `INSERT INTO conversations (order_id, user_id, admin_id, status, unread_count, title)
       VALUES ($1, $2)`,
      [orderId, userId, 7, "open", 0, "Rozmówka o zamówieniu #" +  orderId.toString().padStart(6, "0")]
    );

    await Promise.all(insertItems);

    await client.query("COMMIT");
    res.status(200).json({ id: orderId });

  } catch (err) {
    await client.query("ROLLBACK");
      console.error("❌ Błąd serwera przy tworzeniu zamówienia:", err);
      res.status(500).json({ message: "Błąd serwera", error: err.message });
  } finally {
      client.release();
  }
};
