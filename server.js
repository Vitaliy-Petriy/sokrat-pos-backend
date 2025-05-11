// your-project-root/server.js

// Завантажуємо змінні середовища з .env файлу
require('dotenv').config();

// Імпортуємо необхідні модулі
const express = require('express');
const cors = require('cors');
const pool = require('./db_config'); // Імпортуємо налаштований pool

// Імпортуємо маршрутизатори
const storeRoutes = require('./routes/storeRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const saleRoutes = require('./routes/saleRoutes'); // Додано маршрути для продажів
const authRoutes = require('./routes/authRoutes'); // <--- ДОДАЙТЕ ЦЕЙ РЯДОК

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Логування запитів (простий варіант)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - Body: ${JSON.stringify(req.body)}`);
  next();
});

// --- ДОПОМІЖНА ФУНКЦІЯ ОКРУГЛЕННЯ ДО 50 КОП ---
// Ця функція використовується в saleController.js.
// Якщо ви вирішите винести її в utils.js, то тут її можна буде прибрати,
// а в saleController.js імпортувати з utils.
// Поки що, для простоти, вона може залишатися тут, якщо saleController її не імпортує.
// АЛЕ КРАЩЕ, щоб saleController мав свою копію або імпортував.
// Оскільки ми вже скопіювали її в saleController.js, цей екземпляр тут не обов'язковий,
// якщо тільки не планується використовувати його десь ще глобально.
/*
function roundToNearest50KopServer(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 0;
  }
  const multiplied = amount * 2;
  const rounded = Math.round(multiplied);
  const result = rounded / 2;
  return result;
}
*/

// --- ПІДКЛЮЧЕННЯ МАРШРУТІВ API ---
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes); // Підключено маршрути для продажів

// --- Глобальний обробник помилок (приклад, можна розширити) ---
// Цей middleware має йти ПІСЛЯ всіх маршрутів
app.use((err, req, res, next) => {
  console.error("Неперехоплена помилка:", err.stack);
  res.status(500).json({ error: 'Сталася внутрішня помилка сервера.' });
});


// Простий маршрут для перевірки роботи сервера
app.get('/', (req, res) => {
  res.send('Привіт! Бекенд для POS системи працює!');
});

// Тестовий маршрут для перевірки підключення до бази даних
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect(); // Використовуємо pool, імпортований з db_config
    console.log('Успішно підключено до бази даних PostgreSQL!');
    const result = await client.query('SELECT NOW() as currentTime');
    const currentTime = result.rows[0].currenttime;
    console.log('Поточний час з бази даних:', currentTime);
    client.release();
    res.json({ message: 'Підключення до БД успішне!', dbTime: currentTime });
  } catch (err) {
    console.error('Помилка підключення до бази даних або виконання запиту:', err.stack);
    res.status(500).json({ error: 'Помилка сервера при роботі з базою даних' });
  }
});

// Запускаємо сервер
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
  console.log(`Перейди на http://localhost:${PORT} для перевірки`);
  console.log(`Для тесту БД: http://localhost:${PORT}/api/test-db`);
});