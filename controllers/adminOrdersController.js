export const getOrders = async (req, res) => {
    const { id } = req.params;
    const client = req.dbClient;
    const result = "";

    try {
        console.log("id", id);
        if (id !== "main") {
            result = await client.query(
            "SELECT * FROM orders WHERE id = $1", [id]
        );
        } else {
            result = await client.query(
            "SELECT * FROM orders"
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