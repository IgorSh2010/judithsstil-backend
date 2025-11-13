export const getOrders = async (req, res) => {
  const { id } = req.params;
  const client = req.dbClient;

  try {
    const query =
      id !== "main"
        ? {
            text: `
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
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
              LEFT JOIN payments p ON o.payment_id = p.id
              WHERE o.id = $1
              ORDER BY o.updated_at desc
            `,
            values: [id],
          }
        : {
            text: `
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
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
              LEFT JOIN payments p ON o.payment_id = p.id
              ORDER BY o.updated_at desc
            `,
          };

    const result = await client.query(query);
    res.json(result.rows);
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
