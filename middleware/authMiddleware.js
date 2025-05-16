// your-project-root/middleware/authMiddleware.js

// Тимчасова заглушка, поки ми не реалізували повну автентифікацію
const authenticateToken = (req, res, next) => {
    console.log('Auth Middleware: authenticateToken (заглушка) - доступ дозволено');
    // Тут поки що просто пропускаємо запит, не перевіряючи токен
    // req.user = { userId: 1, username: 'testuser', role: 'admin' }; // Можна додати для тестування authorizeRole
    next();
};

const authorizeRole = (rolesAllowed) => {
    return (req, res, next) => {
        console.log(`Auth Middleware: authorizeRole (заглушка) для ролей [${rolesAllowed.join(', ')}] - доступ дозволено`);
        // Тут поки що просто пропускаємо, не перевіряючи роль
        // if (req.user && rolesAllowed.includes(req.user.role)) {
        //     next();
        // } else {
        //     res.status(403).json({ error: 'Недостатньо прав (заглушка)' });
        // }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };