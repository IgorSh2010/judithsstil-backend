import { apiError } from "../models/errorModel.js";

export const fetchMessages = async (req, res) => {
    const conversationId = req.params.id;
    const client = req.dbClient;
    const userId = req.user?.id;

    if (!userId) {
        client.release();
        return apiError(res, 401, "Brak autoryzacji", "NO_AUTH");
    }

    try {
        //0) Перевіряємо, роль користувача
        const userResult = await client.query(
            `SELECT role FROM public.users WHERE id = $1`,
            [userId]
        );

        const role = userResult.rows[0]?.role;

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

        // Якщо користувач не адмін і не учасник розмови → зась
        if (role !== "admin" && conversationOwnerId !== userId) {
            //client.release();
            return apiError(res, 403, "Nie masz uprawnień do tej rozmowy", "FORBIDDEN");
        }

        // 2) Тягнемо всі повідомлення по розмові
        const messagesResult = await client.query(
            `SELECT 
                m.id, 
                conversation_id,
                CASE
			        WHEN sender_id = $2 THEN 'me'
			        ELSE COALESCE(u.username, 'unknown') || ' (' || u.email || ')'
			    END AS participant,
                content,
                is_read,
                m.created_at                
            FROM judithsstil.messages m
            left join users u on u.id = sender_id
            WHERE conversation_id = $1
            ORDER BY m.created_at ASC;`,
            [conversationId, userId]
        );

        res.json(messagesResult.rows);
    } catch (err) {
        console.error("❌ Помилка при отриманні повідомлень:", err);
        apiError(res, 500, "Server error", err.message);
    } finally {
        client.release();
    }
};

export const sendMessageToConversation = async (req, res) => {
    const conversationId = req.params.id;
    console.log("body - ", req.body);//, "content - ", content);
    const { content } = req.body;    
    const client = req.dbClient;
    const userId = req.user?.id;

    if (!userId) {
        client.release();
        return apiError(res, 401, "Brak autoryzacji", "NO_AUTH");
    }

    try {
        //0) Перевіряємо, роль користувача
        const userResult = await client.query(
            `SELECT role FROM public.users WHERE id = $1`,
            [userId]
        );

        const role = userResult.rows[0]?.role;

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

        // Якщо користувач не адмін і не учасник розмови → зась
        if (role !== "admin" && conversationOwnerId !== userId) {
            //client.release();
            return apiError(res, 403, "Nie masz uprawnień do tej rozmowy", "FORBIDDEN");
        }

        // 2) Додаємо повідомлення
        const messageResult = await client.query(
            `INSERT INTO messages (conversation_id, sender_id, content)
             VALUES ($1, $2, $3) RETURNING id`,
            [conversationId, userId, content]
        );

        //const messageId = messageResult.rows[0].id;

        // 3) Оновлюємо кількість непрочитаних повідомлень
        await client.query(
            `UPDATE conversations 
             SET unread_count = unread_count + 1,
                 updated_at = now() 
             WHERE id = $1`,
            [conversationId]
        );

        //res.json({ messageId });
        
    } catch (err) {
        console.error("❌ Помилка при відправленні повідомлення:", err);
        apiError(res, 500, "Server error", err.message);
    } finally {
        client.release();
    }
};

export const pollConversationUpdates = async (req, res) => {
    const conversationId = req.params.id;
    const lastMessageId = Number(req.query.lastMessageId || 0);

    const client = req.dbClient;
    const userId = req.user?.id;

    if (!userId) {
        client.release();
        return apiError(res, 401, "Brak autoryzacji", "NO_AUTH");
    }

    try {
        // Перевірка прав
        const convCheck = await client.query(
            `SELECT user_id FROM conversations WHERE id = $1`,
            [conversationId]
        );

        if (convCheck.rowCount === 0) {
            return apiError(res, 404, "Rozmowa nie istnieje", "NOT_FOUND");
        }

        const ownerId = convCheck.rows[0].user_id;

        const roleRes = await client.query(`SELECT role FROM users WHERE id=$1`, [userId]);
        const role = roleRes.rows[0]?.role;

        if (role !== "admin" && ownerId !== userId) {
            return apiError(res, 403, "Nie masz uprawnień", "FORBIDDEN");
        }

        // Функція періодичної перевірки
        const checkForNew = async () => {
            const newMessages = await client.query(
                `SELECT 
                    m.id,
                    m.sender_id,
                    u.username,
                    u.email,
                    m.content,
                    m.created_at
                 FROM messages m
                 LEFT JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = $1 AND m.id > $2
                 ORDER BY m.id ASC`,
                 [conversationId, lastMessageId]
            );

            return newMessages.rows;
        };

        let waited = 0;
        const interval = 500;    // кожні 0.5с перевіряємо
        const timeout = 30000;   // максимум 30с

        const polling = setInterval(async () => {
            const newMessages = await checkForNew();

            if (newMessages.length > 0) {
                clearInterval(polling);
                client.release();
                return res.json({ messages: newMessages });
            }

            waited += interval;
            if (waited >= timeout) {
                clearInterval(polling);
                client.release();
                return res.status(204).send(); // Нічого нового
            }
        }, interval);

    } catch (err) {
        console.error("❌ Помилка long polling:", err);
        apiError(res, 500, "Server error", err.message);
        client.release();
    }
};

