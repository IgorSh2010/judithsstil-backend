export const getOrders = async (req, res) => {
    const { id } = req.params;
    const client = req.dbClient;

    try {
        const query =
        id !== "main"
            ? { text: `SELECT id, u.usermame, u.email, u.phone, u.adress, total_price, status_id, payment_id, description 
                        FROM orders
                        LEFT JOIN public.users u ON orders.user_id = u.id 
                        WHERE id = $1`, values: [id] }
            : { text: `SELECT id, u.usermame, u.email, u.phone, u.adress, total_price, status_id, payment_id, description 
                        FROM orders
                        LEFT JOIN public.users u ON orders.user_id = u.id` };

        const result = await client.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Помилка при отриманні замовлень:", err);
        res.status(500).json({ message: "Помилка сервера", error: err.message });
    } finally {
        client.release();
    }
};