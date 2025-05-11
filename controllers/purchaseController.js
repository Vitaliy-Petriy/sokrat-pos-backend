// your-project-root/controllers/purchaseController.js
const pool = require('../db_config');

// Створити новий документ закупівлі
exports.createPurchase = async (req, res) => {
  const { store_id, purchase_date, document_number, items } = req.body;
  if (!store_id || !purchase_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Поля "store_id", "purchase_date" та масив "items" є обов\'язковими і "items" не може бути порожнім.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let calculatedTotalAmount = 0;

    for (const item of items) {
      const quantity = parseFloat(item.quantity);
      const price = parseFloat(item.price_per_unit_purchase);
      if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Некоректна кількість або ціна для товару ID ${item.product_id}` });
      }
      // Перевірка існування product_id (можна додати, хоча БД і так видасть помилку)
      // const productExists = await client.query('SELECT id FROM products WHERE id = $1', [item.product_id]);
      // if (productExists.rows.length === 0) {
      //   await client.query('ROLLBACK');
      //   return res.status(400).json({ error: `Товар з ID ${item.product_id} не знайдено.` });
      // }
      calculatedTotalAmount += quantity * price;
    }
    calculatedTotalAmount = parseFloat(calculatedTotalAmount.toFixed(2)); // Округлення до 2 знаків

    // Створюємо шапку документа закупівлі
    const purchaseResult = await client.query(
      'INSERT INTO purchases (store_id, purchase_date, document_number, total_amount, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, store_id, purchase_date, document_number, total_amount',
      [store_id, purchase_date, document_number || null, calculatedTotalAmount]
    );
    const purchaseId = purchaseResult.rows[0].id;
    const createdPurchaseDocument = purchaseResult.rows[0];
    const createdPurchaseItems = [];

    // Створюємо позиції документа закупівлі (purchase_items)
    for (const item of items) {
      const quantity = parseFloat(item.quantity);
      const price = parseFloat(item.price_per_unit_purchase);
      const itemResult = await client.query(
        'INSERT INTO purchase_items (purchase_id, product_id, store_id, purchase_date, quantity_initial, quantity_remaining, price_per_unit_purchase, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
        [purchaseId, item.product_id, store_id, purchase_date, quantity, quantity, price]
        // Зверніть увагу, purchase_items не має updated_at зазвичай, бо це запис факту, а не редагована сутність
      );
      createdPurchaseItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Документ закупівлі успішно створено', purchase: createdPurchaseDocument, items: createdPurchaseItems });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Помилка створення закупівлі:', err.stack);
    if (err.code === '23503') { // Порушення зовнішнього ключа (product_id або store_id)
      return res.status(400).json({ error: 'Помилка зв\'язку даних: перевірте ID магазину або ID товарів.' });
    }
    res.status(500).json({ error: 'Помилка сервера при створенні закупівлі' });
  } finally {
    client.release();
  }
};

// Отримати всі документи закупівлі
exports.getAllPurchases = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.purchase_date, p.document_number, p.total_amount, s.name as store_name, p.store_id, p.created_at 
       FROM purchases p 
       JOIN stores s ON p.store_id = s.id 
       ORDER BY p.purchase_date DESC, p.id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання списку закупівель:', err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні закупівель' });
  }
};

// Отримати документ закупівлі за ID з його позиціями
exports.getPurchaseById = async (req, res) => {
  const { id } = req.params;
  try {
    const purchaseResult = await pool.query(
      `SELECT p.id, p.purchase_date, p.document_number, p.total_amount, s.name as store_name, p.store_id, p.created_at 
       FROM purchases p 
       JOIN stores s ON p.store_id = s.id 
       WHERE p.id = $1`,
      [id]
    );
    if (purchaseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Документ закупівлі не знайдено' });
    }
    const purchaseDoc = purchaseResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT pi.id, pi.product_id, pr.name as product_name, pr.barcode as product_barcode, 
              pi.quantity_initial, pi.price_per_unit_purchase 
       FROM purchase_items pi 
       JOIN products pr ON pi.product_id = pr.id 
       WHERE pi.purchase_id = $1 
       ORDER BY pr.name ASC`,
      [id]
    );
    purchaseDoc.items = itemsResult.rows;
    res.json(purchaseDoc);
  } catch (err) {
    console.error(`Помилка отримання деталей закупівлі ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні деталей закупівлі' });
  }
};

// Отримати всі позиції з purchase_items
exports.getAllPurchaseItems = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pi.id, pi.purchase_id, pi.purchase_date, p.name as product_name, pi.product_id, 
              s.name as store_name, pi.store_id, pi.quantity_initial, pi.quantity_remaining, 
              pi.price_per_unit_purchase 
       FROM purchase_items pi 
       JOIN products p ON pi.product_id = p.id 
       JOIN stores s ON pi.store_id = s.id 
       ORDER BY pi.purchase_date DESC, pi.id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання позицій закупівель:', err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні позицій закупівель' });
  }
};