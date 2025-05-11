// your-project-root/routes/purchaseRoutes.js
const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController'); // Переконайтесь, що цей шлях правильний

// Маршрути для документів закупівлі

// POST для створення нового документа закупівлі
router.post('/', purchaseController.createPurchase);

// GET для отримання списку всіх документів закупівлі
router.get('/', purchaseController.getAllPurchases);

// GET для отримання всіх позицій закупівлі (purchase_items)
// Цей маршрут має йти ПЕРЕД маршрутом /:id, щоб уникнути конфлікту
router.get('/all-items', purchaseController.getAllPurchaseItems);

// GET для отримання конкретного документа закупівлі за його ID
router.get('/:id', purchaseController.getPurchaseById);

module.exports = router;