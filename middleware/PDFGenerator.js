import PDFDocument from "pdfkit";
import fs from "fs";

export async function generateInvoice(order) {

  //const order = req.order; // замовлення з БД
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

  for (const item of order.items) {
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
}
