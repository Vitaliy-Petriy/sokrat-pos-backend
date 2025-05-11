// your-project-root/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Переконайтесь, що шлях правильний

// Маршрут для обробки POST-запиту на /api/auth/login
router.post('/login', authController.login);

module.exports = router;