// your-project-root/routes/saleRoutes.js
const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController'); // Створимо наступним

// Маршрути для продажів/чеків
router.post('/', saleController.createSale);
router.get('/', saleController.getAllSales);
router.get('/:id', saleController.getSaleById);

module.exports = router;