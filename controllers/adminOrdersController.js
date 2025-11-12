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
                u.address, 
                o.total_price, 
                o.status_id, 
                o.payment_id, 
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
              WHERE o.id = $1
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
                u.address, 
                o.total_price, 
                o.status_id, 
                o.payment_id, 
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
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
