// your-project-root/controllers/saleController.js
const pool = require('../db_config');

// Допоміжна функція округлення (можна винести в utils.js і імпортувати)
function roundToNearest50KopServer(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 0;
  }
  const multiplied = amount * 2;
  const rounded = Math.round(multiplied);
  const result = rounded / 2;
  return result;
}

// Створити новий продаж (чек)
exports.createSale = async (req, res) => {
  const { store_id, user_id, payment_method, overall_discount_percent, items_sold } = req.body;
  if (!store_id || !user_id || !payment_method || !Array.isArray(items_sold) || items_sold.length === 0) {
    return res.status(400).json({ error: 'Поля "store_id", "user_id", "payment_method" та масив "items_sold" є обов\'язковими і "items_sold" не може бути порожнім.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let totalAmountUnrounded = 0;
    const saleItemsToInsert = [];
    const updatedPurchaseItemsLog = []; // Для логування змін у purchase_items

    for (const item of items_sold) {
      if (!item.product_id || item.quantity === undefined || item.price_per_unit_sold === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Для товару не вказано product_id, quantity або price_per_unit_sold` });
      }
      const quantityToSell = parseFloat(item.quantity);
      const priceSold = parseFloat(item.price_per_unit_sold);
      const itemDiscountPercent = parseFloat(item.discount_percent) || 0;

      if (isNaN(quantityToSell) || quantityToSell <= 0 || isNaN(priceSold) || priceSold < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Некоректна кількість або ціна для товару ID ${item.product_id}` });
      }

      const lineTotal = quantityToSell * priceSold * (1 - itemDiscountPercent / 100);
      totalAmountUnrounded += lineTotal;

      // Логіка FIFO для списання товару та розрахунку собівартості
      let quantityStillToProvide = quantityToSell;
      let totalCostForThisSaleItem = 0;

      const productDetailsResult = await client.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
      const productNameForError = productDetailsResult.rows.length > 0 ? productDetailsResult.rows[0].name : `ID ${item.product_id}`;
      
      const availableBatchesResult = await client.query(
        `SELECT id, quantity_remaining, price_per_unit_purchase 
         FROM purchase_items 
         WHERE product_id = $1 AND store_id = $2 AND quantity_remaining > 0 
         ORDER BY purchase_date ASC, id ASC`,
        [item.product_id, store_id]
      );

      let totalQuantityAvailable = 0;
      availableBatchesResult.rows.forEach(b => totalQuantityAvailable += parseFloat(b.quantity_remaining));

      if (totalQuantityAvailable < quantityToSell) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Недостатньо товару '${productNameForError}' на складі магазину ID ${store_id}. В наявності: ${totalQuantityAvailable.toFixed(3)}, потрібно: ${quantityToSell.toFixed(3)}.` });
      }

      for (const batch of availableBatchesResult.rows) {
        if (quantityStillToProvide <= 0) break;
        const quantityFromThisBatch = Math.min(quantityStillToProvide, parseFloat(batch.quantity_remaining));
        totalCostForThisSaleItem += quantityFromThisBatch * parseFloat(batch.price_per_unit_purchase);
        const newRemainingInBatch = parseFloat(batch.quantity_remaining) - quantityFromThisBatch;
        
        await client.query(
          'UPDATE purchase_items SET quantity_remaining = $1 WHERE id = $2',
          [newRemainingInBatch, batch.id]
        );
        updatedPurchaseItemsLog.push({ batch_id: batch.id, old_remaining: parseFloat(batch.quantity_remaining), new_remaining: newRemainingInBatch, taken: quantityFromThisBatch });
        quantityStillToProvide -= quantityFromThisBatch;
      }

      if (quantityStillToProvide > 0.0001) { // Допускаємо малу похибку через float
        console.error(`Критична помилка FIFO: не вдалося повністю забезпечити товар ${productNameForError}. Залишилося забезпечити: ${quantityStillToProvide}`);
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'Внутрішня помилка сервера при обробці FIFO.' });
      }
      saleItemsToInsert.push({
        product_id: item.product_id,
        quantity: quantityToSell,
        price_per_unit_sold: priceSold,
        discount_percent: itemDiscountPercent,
        total_line_amount: parseFloat(lineTotal.toFixed(2)),
        cost_of_goods_sold_fifo: parseFloat(totalCostForThisSaleItem.toFixed(2))
      });
    }

    const finalRoundedAmount = roundToNearest50KopServer(totalAmountUnrounded);
    const saleTimestamp = new Date();
    const tempCheckNumber = `TEMP-${Date.now()}`; // Тимчасовий номер чека

    const saleResult = await client.query(
      'INSERT INTO sales (store_id, user_id, check_number_display, payment_method, total_amount_unrounded, total_amount_rounded, overall_discount_percent, sale_timestamp, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id',
      [store_id, user_id, tempCheckNumber, payment_method, parseFloat(totalAmountUnrounded.toFixed(2)), finalRoundedAmount, overall_discount_percent || 0, saleTimestamp]
    );
    const saleId = saleResult.rows[0].id;
    const checkNumberDisplay = `${store_id}-${saleId}`; // Формуємо остаточний номер чека

    await client.query('UPDATE sales SET check_number_display = $1 WHERE id = $2', [checkNumberDisplay, saleId]);

    for (const si of saleItemsToInsert) {
      await client.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_sold, discount_percent, total_line_amount, cost_of_goods_sold_fifo, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
        [saleId, si.product_id, si.quantity, si.price_per_unit_sold, si.discount_percent, si.total_line_amount, si.cost_of_goods_sold_fifo]
      );
    }

    // Генерація HTML для чека
    let html = `<html><head><title>Чек №${checkNumberDisplay}</title>`;
    html += `<style> body { font-family: 'Arial', sans-serif; font-size: 9pt; line-height: 1.15; margin: 1mm 2mm; padding: 0; width: 55mm; max-width: 55mm; box-sizing: border-box; } .header, .footer { text-align: center; margin-bottom: 3px; font-size: 9.5pt; font-weight: bold;} .meta-info div { margin-bottom: 1px; font-size: 8.5pt; } .meta-info span.label { display: inline-block; min-width: 40px; } .meta-info span.value { font-weight: bold; } .item-separator { border-top: 1px dashed #ccc; margin: 2px 0; } .item-line { margin-bottom: 2px; font-size: 8.5pt;} .item-name { display: block; font-weight: normal; margin-bottom: 1px; } .item-details { display: flex; justify-content: space-between; font-weight: bold; } .item-details .qty-price {} .item-details .sum { text-align: right; } .totals { border-top: 1px solid black; padding-top: 3px; margin-top: 5px; } .total-amount { font-weight: bold; font-size: 10.5pt; text-align: right; } .total-amount .label { display: inline-block; min-width: 20mm; text-align: left; font-weight: bold;} .footer { margin-top: 5px; } * { box-sizing: border-box; } </style></head><body>`;
    html += `<div class="header">Твій Сократ</div>`; // Назва вашого магазину
    const formattedSaleTimestamp = saleTimestamp.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    html += `<div class="meta-info"><div><span class="label">Чек №:</span> <span class="value">${checkNumberDisplay}</span></div><div><span class="label">Дата:</span> <span class="value">${formattedSaleTimestamp}</span></div><div><span class="label">Оплата:</span> <span class="value">${payment_method}</span></div></div>`;
    html += `<div class="item-separator"></div>`;

    for (const item of items_sold) { // Використовуємо items_sold для отримання назв
      const productInfoQuery = await client.query('SELECT name FROM products WHERE id = $1', [item.product_id]);
      const productName = productInfoQuery.rows.length > 0 ? productInfoQuery.rows[0].name : 'Невідомий товар';
      const soldItemDetails = saleItemsToInsert.find(si => si.product_id === item.product_id); // Беремо фінансові деталі з saleItemsToInsert

      html += `<div class="item-line">`;
      html += `<span class="item-name">${productName}</span>`;
      html += `<div class="item-details">`;
      html += `<span class="qty-price">${item.quantity} x ${parseFloat(item.price_per_unit_sold).toFixed(2)}</span>`;
      html += `<span class="sum">${(soldItemDetails ? soldItemDetails.total_line_amount : 0).toFixed(2)}</span>`;
      html += `</div></div>`;
    }
    html += `<div class="totals"><div class="total-amount"><span class="label">ВСЬОГО:</span> ${finalRoundedAmount.toFixed(2)}</div></div>`;
    html += `<div class="footer">Дякуємо!</div>`;
    html += `</body></html>`;

    await client.query('COMMIT');
    console.log("Лог оновлення залишків purchase_items:", updatedPurchaseItemsLog);
    res.status(201).json({ success: true, message: `Чек ${checkNumberDisplay} успішно створено`, checkNumber: checkNumberDisplay, saleId: saleId, checkHtmlContent: html });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Помилка створення продажу:', err.stack);
    res.status(500).json({ error: `Помилка сервера при створенні продажу: ${err.message}` });
  } finally {
    client.release();
  }
};

// Отримати всі продажі (чеки)
exports.getAllSales = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.check_number_display, s.sale_timestamp, s.payment_method, s.total_amount_rounded, 
              st.name as store_name, s.store_id, u.username as user_name, s.user_id 
       FROM sales s 
       JOIN stores st ON s.store_id = st.id 
       JOIN users u ON s.user_id = u.id 
       ORDER BY s.sale_timestamp DESC`
    ); // Додав store_id та user_id для повноти, якщо потрібно фронтенду
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання списку продажів:', err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні продажів' });
  }
};

// Отримати продаж (чек) за ID з його позиціями
exports.getSaleById = async (req, res) => {
  const { id } = req.params;
  try {
    const saleResult = await pool.query(
      `SELECT s.id, s.check_number_display, s.sale_timestamp, s.payment_method, 
              s.total_amount_unrounded, s.total_amount_rounded, s.overall_discount_percent, 
              st.name as store_name, s.store_id, u.username as user_name, s.user_id 
       FROM sales s 
       JOIN stores st ON s.store_id = st.id 
       JOIN users u ON s.user_id = u.id 
       WHERE s.id = $1`,
      [id]
    );
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Чек не знайдено' });
    }
    const saleDoc = saleResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT si.product_id, p.name as product_name, p.barcode as product_barcode, 
              si.quantity, si.price_per_unit_sold, si.discount_percent, 
              si.total_line_amount, si.cost_of_goods_sold_fifo 
       FROM sale_items si 
       JOIN products p ON si.product_id = p.id 
       WHERE si.sale_id = $1 
       ORDER BY p.name ASC`,
      [id]
    );
    saleDoc.items = itemsResult.rows;
    res.json(saleDoc);
  } catch (err) {
    console.error(`Помилка отримання деталей чека ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні деталей чека' });
  }
};