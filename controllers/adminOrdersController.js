export const getOrders = async (req, res) => {
  const { id } = req.params;
  const client = req.dbClient;

  try {
    if (id !== "main") {
    const orderQuery =  `
              SELECT 
                o.id, 
                u.username, 
                u.email, 
                u.phone, 
                u.adress, 
                o.total_price, 
                o.status_id,
                p.method as payment_method, 
                p.status as payment_status,
                p.external_id as payment_external_id,
                p.created_at as payment_date,
                o.created_at as order_date,
                o.updated_at as order_updated_at,
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
              LEFT JOIN payments p ON o.payment_id = p.id
              WHERE o.id = $1
              ORDER BY o.updated_at desc
            `;
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
                products: itemsResult.rows,
            });
                
      } else {
        const query =  `
              SELECT 
                o.id, 
                u.username, 
                u.email, 
                u.phone, 
                u.adress, 
                o.total_price, 
                o.status_id, 
                p.method as payment_method, 
                p.status as payment_status,
                p.external_id as payment_external_id,
                p.created_at as payment_date, 
                o.created_at as order_date,
                o.updated_at as order_updated_at,
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
              LEFT JOIN payments p ON o.payment_id = p.id
              ORDER BY o.updated_at desc
            `;

        const result = await client.query(query);
        res.json(result.rows);
      }

  } catch (err) {
    console.error("❌ Помилка при отриманні замовлень:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const getOrderStatuses = async (req, res) => {
  const client = req.dbClient;
  try {
    const result = await client.query("SELECT * FROM order_statuses");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Помилка при отриманні статусів замовлень:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const getPaymentMethods = async (req, res) => {
  const client = req.dbClient;
  try {
    const result = await client.query("SELECT distinct method FROM payments");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Помилка при отриманні способів оплати:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { statusId } = req.body;
  const client = req.dbClient;
  console.log("id", id, "statusId", statusId);
  try {
    const result = await client.query(
      "UPDATE orders SET status_id = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [id, statusId]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Помилка при оновленні статусу замовлення:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const updateOrderPayment = async (req, res) => {
  const { id } = req.params;
  const { method } = req.body;
  const client = req.dbClient;

  try {
    await client.query("BEGIN");

    const orderRes = await client.query(
      `SELECT * FROM orders  
       WHERE id = $1`,
      [id]
    );

    const order = orderRes.rows[0];

    if (!order) {
      throw new Error("Order not found");
    }

    const paymentRes = await client.query(
      `SELECT * FROM judithsstil.payments WHERE order_id = $1`,
      [id]
    );

    let payment = paymentRes.rows[0];

    if (!payment) {
      const insertRes = await client.query(
        `INSERT INTO payments 
         (order_id, user_id, amount, currency, method, status)
         VALUES ($1, $2, $3, 'PLN', $4, 'dodana przez admina')
         RETURNING *`,
        [
          id,
          order.user_id,
          order.total_price, 
          method
        ]
      );

      payment = insertRes.rows[0];

      await client.query(
        `UPDATE orders 
         SET payment_id = $2,
             updated_at = NOW() 
         WHERE id = $1`,
        [id, payment.id]
      );
    } else {
      // 5) Якщо існує — просто оновлюємо метод
      await client.query(
        `UPDATE judithsstil.payments 
         SET method = $2, updated_at = NOW() 
         WHERE id = $1`,
        [payment.id, method]
      );
    }

    await client.query("COMMIT");

    res.status(200).json({
      orderUpdated: order,
      payment
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Помилка при оновленні способу оплати:", err);
    res.status(500).json({
      message: "Помилка сервера",
      error: err.message
    });
  } finally {
    client.release();
  }
};
