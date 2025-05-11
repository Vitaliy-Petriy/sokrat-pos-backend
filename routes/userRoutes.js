// your-project-root/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Створимо наступним

// Маршрути для користувачів
router.get('/', userController.getAllUsers);
// router.get('/:id', userController.getUserById); // Можна додати, якщо потрібно буде отримувати одного юзера
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;