export const getClientOrder = async (req, res) => {
    const { id } = req.params;
    const client = req.dbClient;
    try {
        if (id !== "main") {
            const orderQuery  = `SELECT o.*, os.label as status_label  FROM orders o
                                left join order_statuses os 
                                    on o.status_id = os.id 
                                WHERE o.id = $1`;

            const orderResult = await client.query(orderQuery, [id]); 

            const itemsQuery = `
                                SELECT 
                                oi.id,
                                p.id AS product_id,
                                p.name,
                                p.price AS product_price,
                                oi.quantity,
                                oi.price AS item_price,
                                (oi.quantity * oi.price) AS total_item
                                FROM judithsstil.order_items oi
                                JOIN judithsstil.products p ON p.id = oi.product_id
                                WHERE oi.order_id = $1
                            `;
            const itemsResult = await client.query(itemsQuery, [id]);

            res.json({
                ...order,
                items: itemsResult.rows,
                history: null, //historyResult.rows,
                payment: null, //paymentResult.rows[0] || null,
            });
            
        } else {
            const result = await client.query(`SELECT o.*, os.label as status_label  FROM orders o
                                                left join order_statuses os 
                                                    on o.status_id = os.id 
                                                WHERE user_id = $1`, [req.user.id]);
            res.json(result.rows);
        }
    } catch (error) {
        console.error("Błąd podczas pobierania zamówień:", error);
        res.status(500).json({ message: "Błąd serwera podczas pobierania zamówień." });
    }
}