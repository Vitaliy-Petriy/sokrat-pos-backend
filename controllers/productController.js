// your-project-root/controllers/productController.js
const pool = require('../db_config');

// Отримати всі товари з пагінацією та загальним залишком
exports.getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const offset = (page - 1) * limit;

  console.log(`[productController] getAllProducts - ЗАПИТ: page=${page}, limit=${limit}, offset=${offset}`);

  try {
    const productsQuery = `
      SELECT 
        p.id, 
        p.barcode, 
        p.name, 
        p.retail_price, 
        p.purchase_price, 
        p.unit, 
        p.created_at, 
        p.updated_at,
        COALESCE(
            (SELECT SUM(pi.quantity_remaining) 
             FROM purchase_items pi 
             WHERE pi.product_id = p.id AND pi.quantity_remaining > 0), 
        0) AS total_stock_remaining
      FROM products p
      ORDER BY p.name ASC 
      LIMIT $1 OFFSET $2
    `;
    // Використання COALESCE(..., 0) гарантує, що якщо підзапит поверне NULL (немає партій),
    // то total_stock_remaining буде 0, а не NULL.

    const productsResult = await pool.query(productsQuery, [limit, offset]);

    // Тепер total_stock_remaining вже має бути числом (або 0) завдяки COALESCE
    // Тому додаткове перетворення на parseFloat(product.total_stock_remaining) || 0 не є строго необхідним,
    // але не зашкодить, якщо дані з БД приходять як рядки.
    // Для більшої певності, що на фронтенд піде число:
    const productsWithNumericStock = productsResult.rows.map(product => ({
      ...product,
      total_stock_remaining: Number(product.total_stock_remaining) // Перетворюємо на число явно
    }));


    const totalCountResult = await pool.query('SELECT COUNT(*) FROM products');
    const totalProducts = parseInt(totalCountResult.rows[0].count);
    const totalPages = Math.ceil(totalProducts / limit);

    const responseObject = {
      products: productsWithNumericStock, // Використовуємо масив з числовим total_stock_remaining
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      limit: limit
    };

    // Логуємо перший товар, якщо є, для перевірки структури
    if (responseObject.products.length > 0) {
        console.log('[productController] getAllProducts - Перший товар у ВІДПОВІДІ СЕРВЕРА:', JSON.stringify(responseObject.products[0], null, 2));
    } else {
        console.log('[productController] getAllProducts - ВІДПОВІДЬ СЕРВЕРА: Товари не знайдено для даної сторінки.');
    }
    
    res.json(responseObject);

  } catch (err) {
    console.error('[productController] Помилка отримання списку товарів з пагінацією та залишками:', err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні товарів' });
  }
};

// Отримати товар за ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query('SELECT id, barcode, name, retail_price, purchase_price, unit, created_at, updated_at FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Товар не знайдено' });
    }
    const product = productResult.rows[0];

    const barcodesResult = await client.query('SELECT id, barcode_value, description FROM barcodes WHERE product_id = $1 ORDER BY id', [id]);
    product.barcodes = barcodesResult.rows; 

    await client.query('COMMIT');
    res.json(product);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Помилка отримання товару ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні товару' });
  } finally {
    client.release();
  }
};

// Створити новий товар
exports.createProduct = async (req, res) => {
  const { barcode, name, retail_price, purchase_price, unit, barcodesArray } = req.body; 
  if (!name || retail_price === undefined) {
    return res.status(400).json({ error: 'Поля "name" та "retail_price" є обов\'язковими' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query(
      'INSERT INTO products (barcode, name, retail_price, purchase_price, unit, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
      [barcode || null, name, parseFloat(retail_price), parseFloat(purchase_price || 0.00), unit || 'шт']
    );
    const newProduct = productResult.rows[0];

    if (Array.isArray(barcodesArray) && barcodesArray.length > 0) {
      for (const bc of barcodesArray) {
        let barcodeValue, description;
        if (typeof bc === 'string') {
          barcodeValue = bc;
          description = null;
        } else if (typeof bc === 'object' && bc.barcode_value) {
          barcodeValue = bc.barcode_value;
          description = bc.description || null;
        } else {
          continue; 
        }
        
        if (barcodeValue) {
          await client.query(
            'INSERT INTO barcodes (product_id, barcode_value, description) VALUES ($1, $2, $3) ON CONFLICT (product_id, barcode_value) DO NOTHING',
            [newProduct.id, barcodeValue, description]
          );
        }
      }
    }

    if (newProduct.barcode && newProduct.barcode.trim() !== '') {
        await client.query(
            'INSERT INTO barcodes (product_id, barcode_value, description) VALUES ($1, $2, $3) ON CONFLICT (product_id, barcode_value) DO NOTHING',
            [newProduct.id, newProduct.barcode, 'Основний штрихкод (з картки товару)']
        );
    }

    await client.query('COMMIT');
    
    // Після коміту, завантажуємо товар з усіма його штрихкодами для відповіді
    const finalProductResult = await pool.query('SELECT id, barcode, name, retail_price, purchase_price, unit, created_at, updated_at FROM products WHERE id = $1', [newProduct.id]);
    const finalBarcodesResult = await pool.query('SELECT id, barcode_value, description FROM barcodes WHERE product_id = $1 ORDER BY id', [newProduct.id]);
    
    const productWithBarcodes = finalProductResult.rows[0];
    productWithBarcodes.barcodes = finalBarcodesResult.rows;

    // Додамо total_stock_remaining для новоствореного товару (буде 0)
    productWithBarcodes.total_stock_remaining = 0;


    res.status(201).json(productWithBarcodes);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Помилка створення товару:', err.stack);
    if (err.code === '23505' && err.constraint === 'barcodes_product_id_barcode_value_key') { // Уточнив назву обмеження, якщо вона така
        return res.status(409).json({ error: 'Один із зазначених штрихкодів вже існує для цього товару або іншого.' });
    }
    res.status(500).json({ error: 'Помилка сервера при створенні товару' });
  } finally {
    client.release();
  }
};

// Оновити товар
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { barcode, name, retail_price, purchase_price, unit } = req.body; 

  if (barcode === undefined && name === undefined && retail_price === undefined && purchase_price === undefined && unit === undefined) {
    return res.status(400).json({ error: 'Потрібно вказати хоча б одне поле для оновлення' });
  }

  const fieldsToUpdate = [];
  const values = [];
  let queryIndex = 1;

  if (barcode !== undefined) { 
    fieldsToUpdate.push(`barcode = $${queryIndex++}`);
    values.push(barcode || null);
  }
  if (name !== undefined) { 
    fieldsToUpdate.push(`name = $${queryIndex++}`); 
    values.push(name); 
  }
  if (retail_price !== undefined) { 
    fieldsToUpdate.push(`retail_price = $${queryIndex++}`); 
    values.push(parseFloat(retail_price)); 
  }
  if (purchase_price !== undefined) {
    fieldsToUpdate.push(`purchase_price = $${queryIndex++}`);
    values.push(parseFloat(purchase_price || 0.00));
  }
  if (unit !== undefined) { 
    fieldsToUpdate.push(`unit = $${queryIndex++}`); 
    values.push(unit || 'шт'); 
  }
  
  if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ error: 'Немає полів для оновлення.' });
  }
  fieldsToUpdate.push(`updated_at = NOW()`);
  values.push(id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const queryString = `UPDATE products SET ${fieldsToUpdate.join(', ')} WHERE id = $${queryIndex} RETURNING *`;
    const productResult = await client.query(queryString, values);

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Товар для оновлення не знайдено' });
    }
    let updatedProduct = productResult.rows[0];

    if (barcode !== undefined) { 
        if (updatedProduct.barcode && updatedProduct.barcode.trim() !== '') {
            await client.query(
                `INSERT INTO barcodes (product_id, barcode_value, description, updated_at) 
                 VALUES ($1, $2, $3, NOW()) 
                 ON CONFLICT (product_id, barcode_value) 
                 DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
                 WHERE barcodes.description = 'Основний штрихкод (з картки товару)' OR barcodes.barcode_value = $2`,
                [updatedProduct.id, updatedProduct.barcode, 'Основний штрихкод (з картки товару)']
            );
        } else {
            await client.query(
                `DELETE FROM barcodes 
                 WHERE product_id = $1 AND description = 'Основний штрихкод (з картки товару)'`,
                [updatedProduct.id]
            );
        }
    }
    await client.query('COMMIT');
    
    // Завантажуємо оновлений товар з усіма його штрихкодами та залишком
    const finalProductQuery = `
        SELECT p.*, COALESCE((SELECT SUM(pi.quantity_remaining) FROM purchase_items pi WHERE pi.product_id = p.id AND pi.quantity_remaining > 0), 0) AS total_stock_remaining
        FROM products p WHERE p.id = $1
    `;
    const finalProductResult = await pool.query(finalProductQuery, [updatedProduct.id]);
    updatedProduct = finalProductResult.rows[0];
    updatedProduct.total_stock_remaining = Number(updatedProduct.total_stock_remaining);


    const finalBarcodesResult = await pool.query('SELECT id, barcode_value, description FROM barcodes WHERE product_id = $1 ORDER BY id', [updatedProduct.id]);
    updatedProduct.barcodes = finalBarcodesResult.rows;

    res.json(updatedProduct);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Помилка оновлення товару ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при оновленні товару' });
  } finally {
    client.release();
  }
};

// Видалити товар
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    // Потрібно видаляти штрихкоди перед видаленням товару, якщо є ON DELETE CASCADE
    // Або робити це в транзакції. Якщо ON DELETE CASCADE налаштовано, то це не потрібно.
    // Припускаємо, що ON DELETE CASCADE є для barcodes.product_id
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Товар для видалення не знайдено' });
    }
    res.status(200).json({ message: 'Товар успішно видалено', deletedProduct: result.rows[0] });
  } catch (err) {
    console.error(`Помилка видалення товару ID ${id}:`, err.stack);
    if (err.code === '23503') { 
      return res.status(409).json({ error: 'Неможливо видалити товар, оскільки він використовується в інших записах (окрім штрихкодів, якщо є ON DELETE CASCADE).' });
    }
    res.status(500).json({ error: 'Помилка сервера при видаленні товару' });
  }
};

// Пошук товарів за назвою або штрихкодом (для автодоповнення)
exports.searchProductsByNameOrBarcode = async (req, res) => {
  const searchTerm = req.query.term ? String(req.query.term).trim() : '';
  const limit = parseInt(req.query.limit) || 10; // Обмежимо кількість результатів

  if (!searchTerm) {
    return res.json([]); // Повертаємо порожній масив, якщо термін пошуку порожній
  }

  try {
    // Пошук по назві товару (LIKE) АБО по основному штрихкоду товару (LIKE)
    // АБО по штрихкодах з таблиці barcodes
    const query = `
      SELECT 
        p.id, 
        p.name, 
        p.barcode, 
        p.retail_price, 
        p.unit,
        COALESCE(
            (SELECT SUM(pi.quantity_remaining) 
             FROM purchase_items pi 
             WHERE pi.product_id = p.id AND pi.quantity_remaining > 0), 
        0) AS total_stock_remaining
      FROM products p
      WHERE 
        (LOWER(p.name) LIKE LOWER($1) OR 
         p.barcode LIKE $1 OR
         EXISTS (SELECT 1 FROM barcodes b WHERE b.product_id = p.id AND b.barcode_value LIKE $1))
      ORDER BY p.name ASC
      LIMIT $2;
    `;
    // $1 - це '%термін_пошуку%'
    const result = await pool.query(query, [`%${searchTerm}%`, limit]);
    
    const productsWithNumericStock = result.rows.map(product => ({
        ...product,
        total_stock_remaining: Number(product.total_stock_remaining)
    }));

    res.json(productsWithNumericStock);

  } catch (err) {
    console.error(`Помилка пошуку товарів за терміном "${searchTerm}":`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при пошуку товарів' });
  }
};

// Додати штрихкод до товару
exports.addProductBarcode = async (req, res) => {
  const { productId } = req.params;
  const { barcode_value, description } = req.body;

  if (!barcode_value) {
    return res.status(400).json({ error: 'Поле "barcode_value" є обов\'язковим' });
  }

  try {
    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    const result = await pool.query(
      'INSERT INTO barcodes (product_id, barcode_value, description, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [productId, barcode_value, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(`Помилка додавання штрихкоду до товару ID ${productId}:`, err.stack);
    if (err.code === '23505' && err.constraint === 'barcodes_product_id_barcode_value_key') { // Уточніть назву вашого унікального ключа
      return res.status(409).json({ error: 'Такий штрихкод вже існує для цього товару.' });
    }
    if (err.code === '23503') { 
        return res.status(404).json({ error: 'Товар для додавання штрихкоду не знайдено.'});
    }
    res.status(500).json({ error: 'Помилка сервера при додаванні штрихкоду' });
  }
};

// Видалити штрихкод у товару
exports.deleteProductBarcode = async (req, res) => {
  const { productId, barcodeId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM barcodes WHERE id = $1 AND product_id = $2 RETURNING *', [barcodeId, productId]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Штрихкод для видалення не знайдено у вказаного товару' });
    }

    const deletedBarcode = result.rows[0];
    if (deletedBarcode.description === 'Основний штрихкод (з картки товару)') {
        await client.query('UPDATE products SET barcode = NULL, updated_at = NOW() WHERE id = $1 AND barcode = $2', [productId, deletedBarcode.barcode_value]);
    }
    
    await client.query('COMMIT');
    res.status(200).json({ message: 'Штрихкод успішно видалено', deletedBarcode: deletedBarcode });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Помилка видалення штрихкоду ID ${barcodeId} для товару ID ${productId}:`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при видаленні штрихкоду' });
  } finally {
    client.release();
  }
};

// Пошук товарів за штрихкодом
exports.findProductsByBarcode = async (req, res) => {
    const { barcodeValue } = req.params;
    if (!barcodeValue) {
        return res.status(400).json({ error: "Значення штрихкоду є обов'язковим" });
    }
    try {
        // Додаємо отримання загального залишку і для цього запиту
        const query = `
            SELECT p.id, p.name, p.barcode as main_barcode, p.retail_price, p.purchase_price, p.unit, 
                   b.id as barcode_id, b.barcode_value as found_barcode, b.description as barcode_description,
                   COALESCE((SELECT SUM(pi.quantity_remaining) FROM purchase_items pi WHERE pi.product_id = p.id AND pi.quantity_remaining > 0), 0) AS total_stock_remaining
            FROM products p
            JOIN barcodes b ON p.id = b.product_id
            WHERE b.barcode_value = $1
        `;
        const result = await pool.query(query, [barcodeValue]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товари з таким штрихкодом не знайдено' });
        }
        // Перетворюємо total_stock_remaining на число
        const productsWithStock = result.rows.map(p => ({...p, total_stock_remaining: Number(p.total_stock_remaining)}));
        res.json(productsWithStock);
    } catch (err) {
        console.error(`Помилка пошуку товарів за штрихкодом ${barcodeValue}:`, err.stack);
        res.status(500).json({ error: 'Помилка сервера при пошуку товарів за штрихкодом' });
    }
};

// Імпорт товарів
exports.importProducts = async (req, res) => {
    // ... (код залишається таким же, як у вашій версії) ...
    // Якщо потрібно, щоб імпортовані/оновлені товари також повертали total_stock_remaining,
    // то після COMMIT, при фінальному запиті товару, потрібно буде додати логіку для отримання залишку.
    // Але для імпорту це може бути надлишковим, якщо основна мета - просто створити/оновити дані товару.
    // Я залишу цю функцію без змін щодо total_stock_remaining, щоб не ускладнювати.
    const productsToImport = req.body; 

    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
        return res.status(400).json({ error: 'Масив товарів для імпорту порожній або не наданий.' });
    }

    const client = await pool.connect();
    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];
    const results = []; // Для деталей успішних операцій

    try {
        await client.query('BEGIN');

        for (const productDataFromFile of productsToImport) {
            const productName = productDataFromFile.name;
            let retailPrice = productDataFromFile.retail_price;
            const unit = productDataFromFile.unit || 'шт';
            const mainBarcode = productDataFromFile.barcode || null;
            const purchasePrice = productDataFromFile.purchase_price; // Додамо для повноти
            const productId = productDataFromFile.id ? parseInt(productDataFromFile.id) : null;

            if (!productName || retailPrice === undefined || retailPrice === null) {
                errorCount++;
                errors.push({ product_name: productName || 'Невідомо', error: 'Відсутня "Назва Товару" або "Роздрібна Ціна".' });
                continue;
            }

            if (typeof retailPrice === 'string') {
                retailPrice = parseFloat(String(retailPrice).replace(',', '.'));
            } else if (typeof retailPrice !== 'number') {
                 errorCount++;
                 errors.push({ product_name: productName, error: 'Некоректний тип даних для "Роздрібна Ціна".' });
                 continue;
            }
            
            if (isNaN(retailPrice)) {
                errorCount++;
                errors.push({ product_name: productName, error: 'Некоректна "Роздрібна Ціна".' });
                continue;
            }
            
            const finalPurchasePrice = purchasePrice !== undefined && purchasePrice !== null ? parseFloat(String(purchasePrice).replace(',', '.')) : 0.00;
             if (isNaN(finalPurchasePrice)) {
                errorCount++;
                errors.push({ product_name: productName, error: 'Некоректна "Закупівельна Ціна".' });
                continue;
            }


            try {
                if (productId) { // Оновлення
                    const updateResult = await client.query(
                        `UPDATE products SET name = $1, retail_price = $2, purchase_price = $3, unit = $4, barcode = $5, updated_at = NOW() 
                         WHERE id = $6 RETURNING *`,
                        [productName, retailPrice, finalPurchasePrice, unit, mainBarcode, productId]
                    );
                    if (updateResult.rowCount > 0) {
                        updatedCount++;
                        results.push({ id: updateResult.rows[0].id, name: productName, status: 'оновлено' });
                        if (mainBarcode && mainBarcode.trim() !== '') {
                            await client.query(
                                `INSERT INTO barcodes (product_id, barcode_value, description, updated_at) 
                                 VALUES ($1, $2, $3, NOW()) 
                                 ON CONFLICT (product_id, barcode_value) 
                                 DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
                                 WHERE barcodes.product_id = $1 AND (barcodes.description = 'Основний штрихкод (з картки товару)' OR barcodes.barcode_value = EXCLUDED.barcode_value)`, // Трохи уточнено умову для оновлення
                                [productId, mainBarcode, 'Основний штрихкод (з картки товару)']
                            );
                        } else if (mainBarcode === null || mainBarcode.trim() === '') { // Якщо основний штрихкод очистили
                             await client.query(
                                `DELETE FROM barcodes WHERE product_id = $1 AND description = 'Основний штрихкод (з картки товару)'`,
                                [productId]
                            );
                        }
                    } else {
                        errorCount++;
                        errors.push({ product_id: productId, product_name: productName, error: 'Товар з ID для оновлення не знайдено.' });
                    }
                } else { // Створення
                    const insertResult = await client.query(
                        `INSERT INTO products (name, retail_price, purchase_price, unit, barcode, created_at, updated_at) 
                         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
                        [productName, retailPrice, finalPurchasePrice, unit, mainBarcode]
                    );
                    const newProduct = insertResult.rows[0];
                    importedCount++;
                    results.push({ id: newProduct.id, name: productName, status: 'імпортовано' });
                    if (mainBarcode && mainBarcode.trim() !== '') {
                        await client.query(
                            'INSERT INTO barcodes (product_id, barcode_value, description) VALUES ($1, $2, $3) ON CONFLICT (product_id, barcode_value) DO NOTHING',
                            [newProduct.id, mainBarcode, 'Основний штрихкод (з картки товару)']
                        );
                    }
                }
            } catch (productError) {
                errorCount++;
                errors.push({ product_name: productName, product_id: productId, error_code: productError.code, error_detail: productError.detail, error: `Помилка БД: ${productError.message.substring(0,100)}` });
                console.error(`Помилка імпорту товару "${productName}" (ID: ${productId}):`, productError);
            }
        }

        if (errorCount > 0 && importedCount === 0 && updatedCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                message: 'Під час імпорту виникли помилки. Жоден товар не було імпортовано/оновлено.', 
                errors: errors,
                importedCount, updatedCount, errorCount
            });
        } else {
            await client.query('COMMIT');
            res.status(errorCount > 0 ? 207 : 200).json({ // 207 Multi-Status, якщо були і успіхи, і помилки
                message: `Імпорт завершено. Імпортовано: ${importedCount}, Оновлено: ${updatedCount}, Помилок: ${errorCount}.`,
                results: results,
                errors: errors,
                importedCount, updatedCount, errorCount
            });
        }
    } catch (err) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rbError) { console.error('Помилка при ROLLBACK:', rbError); }
        }
        console.error('Критична помилка транзакції імпорту товарів:', err.stack);
        res.status(500).json({ error: 'Помилка сервера під час імпорту товарів.', detail: err.message });
    } finally {
        if (client) client.release();
    }
};


// Отримати залишки (партії) товару по магазинах
exports.getProductStockByStores = async (req, res) => {
  const { productId } = req.params;
  if (isNaN(parseInt(productId))) {
    return res.status(400).json({ error: 'Некоректний ID товару' });
  }

  try {
    const query = `
      SELECT 
        pi.id AS purchase_item_id,
        pi.purchase_date,
        pi.quantity_initial,
        pi.quantity_remaining,
        pi.price_per_unit_purchase,
        s.id AS store_id,
        s.name AS store_name,
        p.name AS product_name
      FROM purchase_items pi
      JOIN stores s ON pi.store_id = s.id
      JOIN products p ON pi.product_id = p.id
      WHERE pi.product_id = $1 AND pi.quantity_remaining > 0
      ORDER BY s.name ASC, pi.purchase_date ASC, pi.id ASC;
    `;
    const result = await pool.query(query, [productId]);
    // Якщо не знайдено, повертаємо порожній масив, а не 404
    res.json(result.rows);

  } catch (err) {
    console.error(`Помилка отримання залишків для товару ID ${productId}:`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні залишків товару' });
  }
};