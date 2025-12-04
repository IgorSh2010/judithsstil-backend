import PDFDocument from "pdfkit";

export const getOrders = async (req, res) => {
  const { id } = req.params;
  const client = req.dbClient;

  try {
    if (id !== "main") {
    const orderQuery =  `
              SELECT 
                o.id, 
                u.username, 
                u.email, 
                u.phone, 
                u.adress, 
                o.total_price, 
                o.status_id,
                c.id as conversation_id,
                p.method as payment_method, 
                p.status as payment_status,
                p.external_id as payment_external_id,
                p.created_at as payment_date,
                o.created_at as order_date,
                o.updated_at as order_updated_at,
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
              LEFT JOIN conversations c ON o.id = c.order_id
              LEFT JOIN payments p ON o.payment_id = p.id
              WHERE o.id = $1
              ORDER BY o.updated_at desc
            `;
        const orderResult = await client.query(orderQuery, [id]);        

        if (orderResult.rows.length === 0) {
          return res.status(404).json({ message: "Zamówienie nie znalezione." });
        }

        const order = orderResult.rows[0];
        
        const itemsQuery = `
                            SELECT 
                            oi.id,
                            p.id AS product_id,
                            p.title,
                            img.image_url,
                            p.price AS product_price,
                            oi.quantity,
                            oi.price AS item_price,
                            (oi.quantity * oi.price) AS total_item
                            FROM order_items oi
                            left JOIN products p ON p.id = oi.product_id                            
                            LEFT JOIN LATERAL (
                                                SELECT image_url
                                                FROM product_images
                                                WHERE product_id = p.id
                                                ORDER BY id ASC
                                                LIMIT 1
                                              ) img ON true
                            WHERE oi.order_id = $1
                            `;
            const itemsResult = await client.query(itemsQuery, [id]);

            res.json({
                ...order,
                products: itemsResult.rows,
            });
                
      } else {
        const query =  `
              SELECT 
                o.id, 
                u.username, 
                u.email, 
                u.phone, 
                u.adress, 
                o.total_price, 
                o.status_id, 
                p.method as payment_method, 
                p.status as payment_status,
                p.external_id as payment_external_id,
                p.created_at as payment_date, 
                o.created_at as order_date,
                o.updated_at as order_updated_at,
                o.description
              FROM orders o
              LEFT JOIN public.users u ON o.user_id = u.id
              LEFT JOIN payments p ON o.payment_id = p.id
              ORDER BY o.updated_at desc
            `;

        const result = await client.query(query);
        res.json(result.rows);
      }

  } catch (err) {
    console.error("❌ Помилка при отриманні замовлень:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const getOrderStatuses = async (req, res) => {
  const client = req.dbClient;
  try {
    const result = await client.query("SELECT * FROM order_statuses");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Помилка при отриманні статусів замовлень:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const getPaymentMethods = async (req, res) => {
  const client = req.dbClient;
  try {
    const result = await client.query("SELECT distinct method FROM payments");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Помилка при отриманні способів оплати:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status_id } = req.body;
  const client = req.dbClient;

  try {
    const result = await client.query(
      "UPDATE orders SET status_id = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [id, status_id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Помилка при оновленні статусу замовлення:", err);
    res.status(500).json({ message: "Помилка сервера", error: err.message });
  } finally {
    client.release();
  }
};

export const updateOrderPayment = async (req, res) => {
  const { id } = req.params;
  const { parameter, is_date } = req.body;
  const client = req.dbClient;

  try {
    await client.query("BEGIN");

    const orderRes = await client.query(
      `SELECT * FROM orders  
       WHERE id = $1 AND status_id not in (1, 2, 7)`, // 1 - nowe, 2 - przyjęte, 7 - anulowane
      [id]
    );

    const order = orderRes.rows[0];

    if (!order) {
      return res.status(400).json({ message: "Zamowienie nie istnieje lub nie można edytować płatności ze stanów: nowe, przyjęte, anulowane" });
    }

    const paymentRes = await client.query(
      `SELECT * FROM payments WHERE order_id = $1`,
      [id]
    );

    let payment = paymentRes.rows[0];

    if (!payment) {
      const insertRes = await client.query(
        `INSERT INTO payments 
         (order_id, user_id, amount, currency, method, status)
         VALUES ($1, $2, $3, 'PLN', $4, 'dodana przez admina')
         RETURNING *`,
        [
          id,
          order.user_id,
          order.total_price, 
          parameter
        ]
      );

      payment = insertRes.rows[0];

      await client.query(
        `UPDATE orders 
         SET payment_id = $2,
             updated_at = NOW() 
         WHERE id = $1`,
        [id, payment.id]
      );
    } else {
      
      const text = 
        is_date ? 
        `UPDATE payments
         SET created_at = $2, 
         status = 'edytowana przez admina',
         updated_at = NOW() 
         WHERE id = $1` 
         : 
         `UPDATE payments
         SET method = $2, 
         status = 'edytowana przez admina',
         updated_at = NOW() 
         WHERE id = $1`;

      await client.query(text,
        [payment.id, parameter]
      );
    }

    await client.query("COMMIT");

    res.status(200).json({
      orderUpdated: order,
      payment
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Помилка при оновленні способу оплати:", err);
    res.status(500).json({
      message: "Помилка сервера",
      error: err.message
    });
  } finally {
    client.release();
  }
};

export const getPDFInvoice = async (req, res) => {
  const client = req.dbClient;
  const { orderId } = req.params;
    
  try {
    const orderObject = await client.query(`SELECT o.*, 
                                                  u.username AS customer_name,
                                                  u.email AS customer_email,
                                                  u.phone AS customer_phone,
                                                  u.adress AS customer_adress 
                                            FROM orders o
                                            LEFT JOIN users u 
                                              ON o.user_id = u.id
                                            WHERE o.id = $1`, [orderId]);
    const orderItems = await client.query(`SELECT oi.*, 
                                                  p.title AS name, 
                                                  p.price AS price,
                                                  1 AS qty 
                                           FROM order_items oi 
                                           LEFT JOIN products p 
                                            ON oi.product_id = p.id
                                           WHERE oi.order_id = $1`, [orderId]);

    const order = orderObject.rows[0];
    const invoiceNumber = "FV/" + order.id + "/" + new Date().getFullYear();

      const doc = new PDFDocument({ size: "A4", margin: 40 });

      // Відправляємо PDF як стрім
      res.setHeader("Content-disposition", `attachment; filename="${invoiceNumber}.pdf"`);
      res.setHeader("Content-type", "application/pdf");
      doc.pipe(res);

      // Заголовок
      doc.fontSize(20).text("Faktura VAT", { align: "right" });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Numer: ${invoiceNumber}`, { align: "right" });
      doc.text(`Data wystawienia: ${new Date().toLocaleDateString("pl-PL")}`, { align: "right" });

      doc.moveDown(2);

      // Блоки Sprzedawca / Nabywca
      doc.fontSize(12).text("Sprzedawca:", { bold: true });
      doc.fontSize(10)
        .text("Twoja Firma Sp. z o.o.")
        .text("ul. Przykładowa 12/3, 00-000 Warszawa")
        .text("NIP: 123-456-78-90");

      doc.moveDown(1.5);

      doc.fontSize(12).text("Nabywca:");
      doc.fontSize(10)
        .text(order.customer_name)
        .text(order.customer_address)
        .text(`NIP: ${order.customer_nip ?? "-"}`);

      doc.moveDown(2);

      // Таблиця товарів
      doc.fontSize(12).text("Pozycje:", { underline: true });
      doc.moveDown(0.5);

      // Заголовки
      doc.fontSize(10).text("Nazwa", 40, doc.y);
      doc.text("Ilość", 200, doc.y);
      doc.text("Netto", 260, doc.y);
      doc.text("VAT", 330, doc.y);
      doc.text("Brutto", 390, doc.y);
      doc.moveDown(0.5);

      let totalNet = 0;
      let totalVat = 0;
      let totalBrutto = 0;

      for (const item of orderItems.rows) {
        const net = item.price * item.qty;
        const vatRate = 0.23; // припускаємо 23%
        const vat = net * vatRate;
        const brutto = net + vat;

        totalNet += net;
        totalVat += vat;
        totalBrutto += brutto;

        doc.text(item.name, 40, doc.y);
        doc.text(item.qty, 200, doc.y);
        doc.text(net.toFixed(2) + " zł", 260, doc.y);
        doc.text("23%", 330, doc.y);
        doc.text(brutto.toFixed(2) + " zł", 390, doc.y);
        doc.moveDown(0.5);
      }

      doc.moveDown(2);

      // Підсумки
      doc.fontSize(12).text("Podsumowanie:", { underline: true });
      doc.fontSize(10).moveDown(0.5);
      doc.text(`Razem netto: ${totalNet.toFixed(2)} zł`);
      doc.text(`Razem VAT: ${totalVat.toFixed(2)} zł`);
      doc.text(`Razem brutto: ${totalBrutto.toFixed(2)} zł`);

      doc.moveDown(2);
      doc.fontSize(10).text("Dziękujemy za zakupy!", { align: "center" });

      doc.end();
  } catch (error) {
    console.error("Błąd podczas generowania PDF:", error);
    res.status(500).json({ message: "Błąd serwera podczas generowania PDF." });
  } finally {
    client.release();
  }

};
