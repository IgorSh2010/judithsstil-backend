export const fetchMessages = async (req, res) => {
    const conversationId = req.params.id;
    const client = req.dbClient;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
        client.release();
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        // 1) Перевіряємо, чи існує така розмова та чи має користувач право на неї
        const convCheck = await client.query(
            `SELECT user_id FROM conversations WHERE id = $1`,
            [conversationId]
        );

        if (convCheck.rowCount === 0) {
            //client.release();
            return res.status(500).json({ message: "Conversation not found" });
        }

        const conversationOwnerId = convCheck.rows[0].user_id;

        // Якщо користувач не адмін і не власник розмови → зась
        if (role !== "admin" && user_id !== userId) {
            //client.release();
            return res.status(500).json({ message: "Forbidden" });
        }

        // 2) Тягнемо всі повідомлення по розмові
        const messagesResult = await client.query(
            `SELECT 
                id, 
                conversation_id, 
                sender_id,
                content,
                created_at,
                sender_role
            FROM messages 
            WHERE conversation_id = $1
            ORDER BY created_at ASC`,
            [conversationId]
        );

        res.json(messagesResult.rows);
    } catch (err) {
        console.error("❌ Помилка при отриманні повідомлень:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        client.release();
    }
};
