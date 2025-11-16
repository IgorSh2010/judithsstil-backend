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
