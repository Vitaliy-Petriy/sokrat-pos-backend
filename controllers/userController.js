// your-project-root/controllers/userController.js
const pool = require('../db_config');
const bcrypt = require('bcrypt'); // <--- ОСЬ ТАК МАЄ БУТИ

// Отримати всіх користувачів
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, full_name, store_id, role, is_active, created_at FROM users ORDER BY username ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Помилка отримання списку користувачів:', err.stack);
    res.status(500).json({ error: 'Помилка сервера при отриманні користувачів' });
  }
};

// Створити нового користувача
exports.createUser = async (req, res) => {
  const { username, password, full_name, store_id, role, is_active } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Поля "username", "password" та "role" є обов\'язковими' });
  }

  try { // Переносимо try на початок, щоб охопити і хешування
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds); // <--- ОСЬ ТУТ ЗМІНА

      // Також додамо updated_at в INSERT запит для консистентності
      const result = await pool.query(
        'INSERT INTO users (username, password_hash, full_name, store_id, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id, username, full_name, store_id, role, is_active',
        [username, password_hash, full_name || null, store_id || null, role, is_active === undefined ? true : is_active]
      );
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Помилка створення користувача:', err.stack);
      if (err.code === '23505') {
          return res.status(409).json({ error: 'Користувач з таким логіном вже існує.' });
      }
      if (err.code === '23503') {
          return res.status(400).json({ error: 'Вказаний магазин (store_id) не існує.' });
      }
      res.status(500).json({ error: 'Помилка сервера при створенні користувача' });
  }
};

// Оновити користувача
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, password, full_name, store_id, role, is_active } = req.body;

  const fieldsToUpdate = [];
  const values = [];
  let queryIndex = 1;

  if (username !== undefined) {
    fieldsToUpdate.push(`username = $${queryIndex++}`);
    values.push(username);
  }
  if (password !== undefined && password !== '') {
    const saltRounds = 10; // Можна винести в константу на рівні модуля, якщо використовується в кількох місцях
    const password_hash = await bcrypt.hash(password, saltRounds); // <--- ОСЬ ТУТ ЗМІНА
    fieldsToUpdate.push(`password_hash = $${queryIndex++}`);
    values.push(password_hash);
  }
  if (full_name !== undefined) {
    fieldsToUpdate.push(`full_name = $${queryIndex++}`);
    values.push(full_name || null);
  }
  if (store_id !== undefined) {
    fieldsToUpdate.push(`store_id = $${queryIndex++}`);
    values.push(store_id === '' || store_id === null ? null : parseInt(store_id));
  }
  if (role !== undefined) {
    fieldsToUpdate.push(`role = $${queryIndex++}`);
    values.push(role);
  }
  if (is_active !== undefined) {
    fieldsToUpdate.push(`is_active = $${queryIndex++}`);
    values.push(is_active);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: 'Немає полів для оновлення.' });
  }

  values.push(id); // ID для умови WHERE

  try {
    const queryString = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${queryIndex} RETURNING id, username, full_name, store_id, role, is_active`;
    const result = await pool.query(queryString, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Користувача для оновлення не знайдено' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`Помилка оновлення користувача ID ${id}:`, err.stack);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Користувач з таким логіном вже існує.' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Вказаний магазин (store_id) не існує.' });
    }
    res.status(500).json({ error: 'Помилка сервера при оновленні користувача' });
  }
};

// Видалити користувача
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    // Перевірка, чи не намагається користувач видалити сам себе (якщо є логіка поточного користувача)
    // Або чи не є це останній адмін тощо - це вже бізнес-логіка
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Користувача для видалення не знайдено' });
    }
    res.status(200).json({ message: 'Користувача успішно видалено', deletedUser: result.rows[0] });
  } catch (err) {
    console.error(`Помилка видалення користувача ID ${id}:`, err.stack);
    // Тут можна перевірити err.code === '23503', якщо користувач пов'язаний з чеками тощо,
    // але зазвичай користувачів не видаляють фізично, а роблять неактивними.
    res.status(500).json({ error: 'Помилка сервера при видаленні користувача' });
  }
};