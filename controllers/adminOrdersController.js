export const getOrders = async (req, res) => {
    const { id } = req.params;
    const client = req.dbClient;
    const result = "";

    try {
        if (id !== "main") {
            result = await client.query(
            "SELECT id, user_id, total_price, status_id, payment_id, description FROM orders WHERE id = $1", [id]
        );
        } else {
            console.log("id", id);
            result = await client.query(
            "SELECT id, user_id, total_price, status_id, payment_id, description FROM orders"
        );
        }

        res.json(result.rows);
    } catch (err) {
        console.error("❌ Помилка при отриманні замовлень:", err);
        res.status(500).json({ message: "Помилка сервера", error: err.message });
    } finally {
        client.release();
    }
};