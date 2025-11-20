import { apiError } from "../models/errorModel.js";

export const fetchMessages = async (req, res) => {
    const conversationId = req.params.id;
    const client = req.dbClient;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
        client.release();
        return apiError(res, 401, "Brak autoryzacji", "NO_AUTH");
    }

    try {
        // 1) Перевіряємо, чи існує така розмова та чи має користувач право на неї
        const convCheck = await client.query(
            `SELECT user_id FROM conversations WHERE id = $1`,
            [conversationId]
        );

        if (convCheck.rowCount === 0) {
            //client.release();
            return apiError(res, 404, "Rozmowa nie istnieje", "NOT_FOUND");
        }

        const conversationOwnerId = convCheck.rows[0].user_id;

        // Якщо користувач не адмін і не власник розмови → зась
        if (role !== "admin" && user_id !== userId) {
            //client.release();
            return apiError(res, 403, "Nie masz uprawnień do tej rozmowy", "FORBIDDEN");
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
        apiError(res, 500, "Server error", err.message);
    } finally {
        client.release();
    }
};
