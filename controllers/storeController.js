// your-project-root/controllers/storeController.js
const pool = require('../db_config'); // Імпортуємо наш налаштований pool

// Отримати всі магазини
exports.getAllStores = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, address, created_at FROM stores ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання списку магазинів:', err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні магазинів' });
  }
};

// Отримати магазин за ID
exports.getStoreById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT id, name, address, created_at FROM stores WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Магазин не знайдено' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`Помилка отримання магазину ID ${id}:`, err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні магазину' });
  }
};

// Створити новий магазин
exports.createStore = async (req, res) => {
  const { name, address } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Поле "name" є обов\'язковим' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO stores (name, address, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
      [name, address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Помилка створення магазину:', err.stack);
    if (err.code === '23505') { // Код помилки для унікального індексу в PostgreSQL
        return res.status(409).json({ error: 'Магазин з такою назвою вже існує.' });
    }
    res.status(500).json({ error: 'Помилка сервера при створенні магазину' });
  }
};

// Оновити магазин
exports.updateStore = async (req, res) => {
  const { id } = req.params;
  const { name, address } = req.body;
  if (!name && address === undefined) { // Перевіряємо, чи є хоч щось для оновлення
    return res.status(400).json({ error: 'Потрібно вказати хоча б одне поле для оновлення (name або address)' });
  }
  const fieldsToUpdate = [];
  const values = [];
  let queryIndex = 1;

  if (name !== undefined) {
    fieldsToUpdate.push(`name = $${queryIndex++}`);
    values.push(name);
  }
  if (address !== undefined) {
    fieldsToUpdate.push(`address = $${queryIndex++}`);
    values.push(address || null); // Якщо address порожній рядок, ставимо null
  }
  
  fieldsToUpdate.push(`updated_at = NOW()`); // Завжди оновлюємо updated_at

  values.push(id); // ID для умови WHERE

  try {
    const queryString = `UPDATE stores SET ${fieldsToUpdate.join(', ')} WHERE id = $${queryIndex} RETURNING *`;
    const result = await pool.query(queryString, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Магазин для оновлення не знайдено' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`Помилка оновлення магазину ID ${id}:`, err.stack);
    if (err.code === '23505') { // Код помилки для унікального індексу в PostgreSQL
      return res.status(409).json({ error: 'Магазин з такою назвою вже існує.' });
    }
    res.status(500).json({ error: 'Помилка сервера при оновленні магазину' });
  }
};

// Видалити магазин
exports.deleteStore = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM stores WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) { // rowCount показує кількість видалених рядків
      return res.status(404).json({ error: 'Магазин для видалення не знайдено' });
    }
    res.status(200).json({ message: 'Магазин успішно видалено', deletedStore: result.rows[0] });
  } catch (err) {
    console.error(`Помилка видалення магазину ID ${id}:`, err.stack);
    if (err.code === '23503') { // Помилка порушення зовнішнього ключа
      return res.status(409).json({ error: 'Неможливо видалити магазин, оскільки він використовується в інших записах.' });
    }
    res.status(500).json({ error: 'Помилка сервера при видаленні магазину' });
  }
};