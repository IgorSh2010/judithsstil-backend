export const getOrders = async (req, res) => {
    const { id } = req.params;
    const client = req.dbClient;

    try {
        const query =
        id !== "main"
            ? { text: "SELECT id, user_id, total_price, status_id, payment_id, description FROM orders WHERE id = $1", values: [id] }
            : { text: "SELECT id, user_id, total_price, status_id, payment_id, description FROM orders" };

        const result = await client.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Помилка при отриманні замовлень:", err);
        res.status(500).json({ message: "Помилка сервера", error: err.message });
    } finally {
        client.release();
    }
};