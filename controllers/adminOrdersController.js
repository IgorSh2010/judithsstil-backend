export const getAllOrders = async (req, res) => {
    //const { id } = req.params;
    const client = req.dbClient;

    try {
        const result = await client.query(
            "SELECT * FROM orders"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Помилка при отриманні замовлень:", err);
        res.status(500).json({ message: "Помилка сервера", error: err.message });
    } finally {
        client.release();
    }
};