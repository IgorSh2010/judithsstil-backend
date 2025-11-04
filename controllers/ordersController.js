export const getClientOrder = async (req, res) => {
    const client = req.dbClient;
    try {
        const result = await client.query(`SELECT o.*, os.label as status_label  FROM orders o
                                            left join order_statuses os 
                                                on o.status_id = os.id 
                                            WHERE user_id = $1`, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error("Błąd podczas pobierania zamówień:", error);
        res.status(500).json({ message: "Błąd serwera podczas pobierania zamówień." });
    }
}