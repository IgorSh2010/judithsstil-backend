import PDFDocument from "pdfkit";
import path from "path";

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
    const orderObject = await client.query(`
      SELECT o.*, 
             u.username AS customer_name,
             u.email AS customer_email,
             u.phone AS customer_phone,
             u.adress AS customer_address,
             '12-123-1239-25' AS customer_nip
        FROM orders o
   LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1
    `, [orderId]);

    const orderItems = await client.query(`
      SELECT oi.*, 
             p.title AS name, 
             p.price AS price,
             oi.quantity AS qty
        FROM order_items oi
   LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1
    `, [orderId]);

    const order = orderObject.rows[0];
    const invoiceNumber = "FV/" + order.id + "/" + new Date().getFullYear();

    // === PDF GENERATION ===
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    // Load TTF font that supports PL letters
    doc.registerFont("Regular", path.join("fonts", "OpenSans-Regular.ttf"));
    doc.registerFont("Bold", path.join("fonts", "OpenSans-Bold.ttf"));
    doc.registerFont("Italic", path.join("fonts", "OpenSans-Italic.ttf"));
    doc.font("Regular");

    res.setHeader("Content-disposition", `attachment; filename="${invoiceNumber}.pdf"`);
    res.setHeader("Content-type", "application/pdf");
    doc.pipe(res);

    // HEADER
    doc.font("Bold").fontSize(20).text("Faktura VAT", { align: "right" });
    doc.moveDown(0.3);
    doc.font("Regular").fontSize(10).text(`Numer: ${invoiceNumber}`, { align: "right" });
    doc.text(`Data wystawienia: ${new Date().toLocaleDateString("pl-PL")}`, { align: "right" });
    doc.moveDown(2);

    // SELLER / BUYER
    doc.font("Bold").fontSize(12).text("Sprzedawca:");
    doc.font("Regular").fontSize(10)
      .text("Judith's Stil – Sklep internetowy")
      .text("ul. Przykładowa 12/3, 00-000 Warszawa")
      .text("NIP: 123-456-78-90");

    doc.moveDown(1.5);

    doc.font("Bold").fontSize(12).text("Nabywca:");
    doc.font("Regular").fontSize(10)
      .text(order.customer_name || "-")
      .text(order.customer_address || "-")
      .text(`NIP: ${order.customer_nip || "-"}`);

    doc.moveDown(2);

    // TABLE HEADER BACKGROUND
    const tableTop = doc.y;
    const rowHeight = 24;

    doc.rect(40, tableTop, 515, rowHeight).fill("#eeeeee");
    doc.fillColor("#000");

    // HEADERS
    doc.font("Bold").fontSize(10);

    doc.text("Nazwa", 50, tableTop + 7);
    doc.text("Ilość", 220, tableTop + 7);
    doc.text("Netto", 280, tableTop + 7);
    doc.text("VAT", 350, tableTop + 7);
    doc.text("Brutto", 420, tableTop + 7);

    doc.moveDown();

    // TABLE BORDER LINES
    doc.moveTo(40, tableTop).lineTo(555, tableTop).stroke();
    doc.moveTo(40, tableTop + rowHeight).lineTo(555, tableTop + rowHeight).stroke();

    // ITEMS
    let currentY = tableTop + rowHeight + 5;
    let totalNet = 0;
    let totalVat = 0;
    let totalBrutto = 0;

    doc.font("Regular").fontSize(10);

    for (const item of orderItems.rows) {
      const net = item.price * item.qty;
      const vatRate = 0.23;
      const vat = net * vatRate;
      const brutto = net + vat;

      totalNet += net;
      totalVat += vat;
      totalBrutto += brutto;

      // row border
      doc.moveTo(40, currentY - 3).lineTo(555, currentY - 3).stroke();

      doc.text(item.name, 50, currentY);
      doc.text(item.qty, 220, currentY);
      doc.text(net.toFixed(2) + " zł", 280, currentY);
      doc.text("23%", 350, currentY);
      doc.text(brutto.toFixed(2) + " zł", 420, currentY);

      currentY += rowHeight;
    }

    // Last border
    doc.moveTo(40, currentY - 3).lineTo(555, currentY - 3).stroke();

    doc.moveDown(2);

    // SUMMARY BLOCK
    doc.font("Bold").fontSize(12).text("Podsumowanie:");
    doc.font("Regular").fontSize(10).moveDown(0.5);

    doc.text(`Razem netto: ${totalNet.toFixed(2)} zł`);
    doc.text(`Razem VAT: ${totalVat.toFixed(2)} zł`);
    doc.text(`Razem brutto: ${totalBrutto.toFixed(2)} zł`);

    doc.moveDown(3);
    doc.font("Italic").fontSize(10).text("Dziękujemy za zakupy!", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Błąd generowania PDF:", error);
    res.status(500).json({ message: "Błąd serwera podczas generowania PDF." });
  } finally {
    client.release();
  }
};
