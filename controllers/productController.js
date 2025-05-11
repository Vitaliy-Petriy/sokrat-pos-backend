// your-project-root/controllers/productController.js
const pool = require('../db_config');

// Отримати всі товари
exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, barcode, name, retail_price, purchase_price, unit, created_at, updated_at FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання списку товарів:', err.stack);
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
    
    const finalProductResult = await client.query('SELECT id, barcode, name, retail_price, purchase_price, unit, created_at, updated_at FROM products WHERE id = $1', [newProduct.id]);
    const finalBarcodesResult = await client.query('SELECT id, barcode_value, description FROM barcodes WHERE product_id = $1 ORDER BY id', [newProduct.id]);
    const productWithBarcodes = finalProductResult.rows[0];
    productWithBarcodes.barcodes = finalBarcodesResult.rows;

    res.status(201).json(productWithBarcodes);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Помилка створення товару:', err.stack);
    if (err.code === '23505' && err.constraint === 'unique_product_barcode') {
        return res.status(409).json({ error: 'Один із зазначених штрихкодів вже існує для цього товару.' });
    }
    // Можна додати перевірку на інші унікальні обмеження таблиці products, якщо вони є
    // if (err.code === '23505' && err.constraint === 'products_name_unique_constraint_name') { ... }
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
    const updatedProduct = productResult.rows[0];

    if (barcode !== undefined) { // Якщо поле barcode було в запиті на оновлення
        if (updatedProduct.barcode && updatedProduct.barcode.trim() !== '') {
            // Оновлюємо або додаємо "основний" штрихкод в таблицю barcodes
            await client.query(
                `INSERT INTO barcodes (product_id, barcode_value, description, updated_at) 
                 VALUES ($1, $2, $3, NOW()) 
                 ON CONFLICT (product_id, barcode_value) 
                 DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
                 WHERE barcodes.description = 'Основний штрихкод (з картки товару)' OR barcodes.barcode_value = $2`, // Оновлюємо, якщо це "основний" або якщо значення співпадає
                [updatedProduct.id, updatedProduct.barcode, 'Основний штрихкод (з картки товару)']
            );
            // Можливо, потрібно видалити старий "основний", якщо значення змінилося, а не просто оновився опис
            // Ця логіка може бути складнішою, якщо потрібно гарантувати тільки один "основний"
        } else {
            // Якщо products.barcode очистили, видаляємо відповідний запис "основного" з barcodes
            await client.query(
                `DELETE FROM barcodes 
                 WHERE product_id = $1 AND description = 'Основний штрихкод (з картки товару)'`,
                [updatedProduct.id]
            );
        }
    }

    await client.query('COMMIT');
    
    const finalBarcodesResult = await client.query('SELECT id, barcode_value, description FROM barcodes WHERE product_id = $1 ORDER BY id', [updatedProduct.id]);
    updatedProduct.barcodes = finalBarcodesResult.rows;

    res.json(updatedProduct);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Помилка оновлення товару ID ${id}:`, err.stack);
    // Тут можна додати перевірку err.code для specific constraints, якщо потрібно
    res.status(500).json({ error: 'Помилка сервера при оновленні товару' });
  } finally {
    client.release();
  }
};

// Видалити товар
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Товар для видалення не знайдено' });
    }
    res.status(200).json({ message: 'Товар успішно видалено', deletedProduct: result.rows[0] });
  } catch (err) {
    console.error(`Помилка видалення товару ID ${id}:`, err.stack);
    if (err.code === '23503') { 
      return res.status(409).json({ error: 'Неможливо видалити товар, оскільки він використовується в інших записах (окрім штрихкодів).' });
    }
    res.status(500).json({ error: 'Помилка сервера при видаленні товару' });
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
    if (err.code === '23505' && err.constraint === 'unique_product_barcode') { 
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
  const client = await pool.connect(); // Використовуємо транзакцію для узгодженості
  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM barcodes WHERE id = $1 AND product_id = $2 RETURNING *', [barcodeId, productId]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Штрихкод для видалення не знайдено у вказаного товару' });
    }

    const deletedBarcode = result.rows[0];
    // Якщо видалений штрихкод був "основним", очищуємо поле barcode в таблиці products
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
        const result = await pool.query(
            `SELECT p.id, p.name, p.barcode as main_barcode, p.retail_price, p.purchase_price, p.unit, 
                    b.id as barcode_id, b.barcode_value as found_barcode, b.description as barcode_description
             FROM products p
             JOIN barcodes b ON p.id = b.product_id
             WHERE b.barcode_value = $1`,
            [barcodeValue]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товари з таким штрихкодом не знайдено' });
        }
        res.json(result.rows);
    } catch (err) {
        console.error(`Помилка пошуку товарів за штрихкодом ${barcodeValue}:`, err.stack);
        res.status(500).json({ error: 'Помилка сервера при пошуку товарів за штрихкодом' });
    }
};

// --- НОВА ФУНКЦІЯ ДЛЯ ІМПОРТУ ТОВАРІВ ---
exports.importProducts = async (req, res) => {
    const productsToImport = req.body; 

    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
        return res.status(400).json({ error: 'Масив товарів для імпорту порожній або не наданий.' });
    }

    const client = await pool.connect();
    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];
    const results = [];

    try {
        await client.query('BEGIN');

        for (const productDataFromFile of productsToImport) {
            // Очікуємо ключі точно як при експорті (регістр може відрізнятися на фронтенді при парсингу)
            // Фронтенд має надсилати об'єкти з нормалізованими ключами
            const productName = productDataFromFile.name; // Очікуємо ключ 'name'
            let retailPrice = productDataFromFile.retail_price; // Очікуємо 'retail_price'
            const unit = productDataFromFile.unit || 'шт';
            const mainBarcode = productDataFromFile.barcode || null;
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

            try {
                if (productId) { // Оновлення
                    const updateResult = await client.query(
                        `UPDATE products SET name = $1, retail_price = $2, unit = $3, barcode = $4, updated_at = NOW() 
                         WHERE id = $5 RETURNING *`,
                        [productName, retailPrice, unit, mainBarcode, productId]
                    );
                    if (updateResult.rowCount > 0) {
                        updatedCount++;
                        results.push({ id: updateResult.rows[0].id, name: productName, status: 'оновлено' });
                        if (mainBarcode) {
                            await client.query(
                                `INSERT INTO barcodes (product_id, barcode_value, description, updated_at) 
                                 VALUES ($1, $2, $3, NOW()) 
                                 ON CONFLICT (product_id, barcode_value) 
                                 DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
                                 WHERE barcodes.description = 'Основний штрихкод (з картки товару)' OR barcodes.barcode_value = EXCLUDED.barcode_value`,
                                [productId, mainBarcode, 'Основний штрихкод (з картки товару)']
                            );
                        } else {
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
                        `INSERT INTO products (name, retail_price, unit, barcode, created_at, updated_at) 
                         VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
                        [productName, retailPrice, unit, mainBarcode]
                    );
                    const newProduct = insertResult.rows[0];
                    importedCount++;
                    results.push({ id: newProduct.id, name: productName, status: 'імпортовано' });
                    if (mainBarcode) {
                        await client.query(
                            'INSERT INTO barcodes (product_id, barcode_value, description) VALUES ($1, $2, $3) ON CONFLICT (product_id, barcode_value) DO NOTHING',
                            [newProduct.id, mainBarcode, 'Основний штрихкод (з картки товару)']
                        );
                    }
                }
            } catch (productError) {
                errorCount++;
                errors.push({ product_name: productName, error: `Помилка БД: ${productError.message.substring(0,100)}` });
                console.error(`Помилка імпорту товару "${productName}":`, productError);
            }
        }

        if (errorCount > 0 && importedCount === 0 && updatedCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                message: 'Під час імпорту виникли помилки. Жоден товар не було імпортовано/оновлено.', 
                errors: errors 
            });
        } else {
            await client.query('COMMIT');
            res.status(200).json({
                message: `Імпорт завершено. Імпортовано: ${importedCount}, Оновлено: ${updatedCount}, Помилок: ${errorCount}.`,
                results: results,
                errors: errors
            });
        }
    } catch (err) {
        if (client) await client.query('ROLLBACK'); // Перевірка, чи client існує
        console.error('Критична помилка транзакції імпорту товарів:', err.stack);
        res.status(500).json({ error: 'Помилка сервера під час імпорту товарів.' });
    } finally {
        if (client) client.release();
    }
};