// your-project-root/controllers/authController.js
const pool = require('../db_config');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Логін та пароль є обов\'язковими' });
    }

    try {
        const userResult = await pool.query(
            'SELECT id, username, password_hash, role, store_id, is_active, full_name FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            // Користувача не знайдено
            return res.status(401).json({ error: 'Невірний логін або пароль' });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            // Обліковий запис неактивний
            return res.status(403).json({ error: 'Обліковий запис користувача неактивний' });
        }

        // Порівнюємо наданий пароль з хешованим паролем у базі
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            // Паролі не співпадають
            return res.status(401).json({ error: 'Невірний логін або пароль' });
        }

        // Пароль вірний, генеруємо JWT (JSON Web Token)
        const tokenPayload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            storeId: user.store_id // Може бути null, якщо користувач не прив'язаний до магазину
        };

        // Підписуємо токен секретним ключем
        // JWT_SECRET має бути визначений у вашому .env файлі
        // expiresIn - час життя токена
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Наприклад, 1 година. Можна змінити на '7d', '30m' тощо.
        );

        // Повертаємо токен та деяку інформацію про користувача (без пароля)
        res.json({
            message: 'Вхід успішний',
            token,
            userId: user.id,
            username: user.username,
            role: user.role,
            storeId: user.store_id,
            fullName: user.full_name // Може бути корисним на фронтенді
        });

    } catch (err) {
        console.error('Помилка входу:', err.stack);
        res.status(500).json({ error: 'Помилка сервера під час входу' });
    }
};