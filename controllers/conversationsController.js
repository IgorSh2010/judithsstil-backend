import { apiError } from "../models/errorModel.js";

export const getConversations = async (req, res) => {
    const client = req.dbClient;
    const userId = req.user?.id;

    if (!userId) {
        client.release();
        return apiError(res, 401, "Brak autoryzacji", "NO_AUTH");
    }

    try {
        // Тягнемо всі розмови, які має користувач, або які має адмін
        const conversationsResult = await client.query(
            `SELECT 
                id, order_id, updated_at, unread_count, title,
                (SELECT content FROM judithsstil.messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                (SELECT created_at FROM judithsstil.messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
            FROM conversations
            WHERE user_id = $1 OR admin_id = $1
            ORDER BY last_message_at DESC NULLS LAST, updated_at DESC;`, [userId]
        );

        const conversations = conversationsResult.rows[0] || { rows: [] };

        // Якщо таких розмов нема → зась
        if ( conversations.rowCount === 0 ) {
            client.release();
            return apiError(res, 403, "Jeszcze nie masz żadnych rozmów", "FORBIDDEN");
        }       

        res.json(conversationsResult.rows);
        
    } catch (err) {
        console.error("Błąd podczas pobierania rozmów:", err);
        res.status(500).json({ message: "Błąd serwera podczas pobierania rozmów." });
    } finally {
        client.release();
    }
}

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
            client.release();
            return apiError(res, 404, "Rozmowa nie istnieje", "NOT_FOUND");
        }

        const conversationOwnerId = convCheck.rows[0].user_id;

        // Якщо користувач не адмін і не учасник розмови → зась
        if (role !== "admin" && conversationOwnerId !== userId) {
            client.release();
            return apiError(res, 403, "Nie masz uprawnień do tej rozmowy", "FORBIDDEN");
        }

        // 2) Тягнемо всі повідомлення по розмові
        const messagesResult = await client.query(
            `SELECT 
                m.id, 
                conversation_id,
                order_id,
                CASE
			        WHEN sender_id = $2 THEN 'me'
			        ELSE COALESCE(u.username, 'unknown') || ' (' || u.email || ')'
			    END AS participant,
                content,
                is_read,
                m.created_at                
            FROM judithsstil.messages m
            left join users u on u.id = sender_id
            left join conversations c on c.id = conversation_id
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

        const messageId = messageResult.rows[0].id;

        // 3) Оновлюємо кількість непрочитаних повідомлень
        await client.query(
            `UPDATE conversations 
             SET unread_count = unread_count + 1,
                 updated_at = now() 
             WHERE id = $1`,
            [conversationId]
        );

        res.json({ messageId });
        
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
    console.log("lastMessageId - ", lastMessageId, "req.query.lastMessageId - ", req.query.lastMessageId);
    const client = req.dbClient;
    const userId = req.user?.id;

    if (!userId) {
        client.release();
        return apiError(res, 401, "Brak autoryzacji", "NO_AUTH");
    }

    try {
        console.log("conversationId - ", conversationId);
        // Перевірка прав
        const convCheck = await client.query(
            `SELECT user_id FROM conversations WHERE id = $1`,
            [conversationId]
        );

        if (convCheck.rowCount === 0) {
            client.release();
            return apiError(res, 404, "Rozmowa nie istnieje", "NOT_FOUND");
        }

        const ownerId = convCheck.rows[0].user_id;

        const roleRes = await client.query(`SELECT role FROM users WHERE id=$1`, [userId]);
        const role = roleRes.rows[0]?.role;

        if (role !== "admin" && ownerId !== userId) {
            client.release();
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
    } finally {
        //client.release(); //Тут нічого не робимо, бо відвалюється сам клієнт і не очікується відповідь
    }
};

export const markConversationRead = async (req, res) => {
  const { id: conversationId } = req.params;
  const client = req.dbClient;
  const userId = req.user?.id;
  if (!userId) {
    client.release();
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await client.query("BEGIN");

    // 1) Помітити як прочитані повідомлення, які НЕ від поточного користувача
    await client.query(
      `UPDATE messages
       SET is_read = true
       WHERE conversation_id = $1
         AND sender_id <> $2
         AND is_read = false`,
      [conversationId, userId]
    );

    // 2) Обнулити лічильник unread_count в conversations
    await client.query(
      `UPDATE conversations
       SET unread_count = 0, updated_at = now()
       WHERE id = $1`,
      [conversationId]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Mark read error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};


