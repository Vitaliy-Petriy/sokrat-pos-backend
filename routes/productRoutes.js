// your-project-root/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController'); // Переконайтесь, що шлях правильний

// Маршрути для товарів

// GET для отримання всіх товарів
router.get('/', productController.getAllProducts);

// GET для пошуку товарів за значенням штрихкоду
// Цей маршрут має йти перед '/:id', щоб 'by-barcode' не сприймалося як ID
router.get('/by-barcode/:barcodeValue', productController.findProductsByBarcode);

// GET для отримання конкретного товару за його ID
router.get('/:id', productController.getProductById);

// POST для створення нового товару
router.post('/', productController.createProduct);

// POST для імпорту товарів з файлу
router.post('/import', productController.importProducts);

// PUT для оновлення існуючого товару за його ID
router.put('/:id', productController.updateProduct);

// DELETE для видалення товару за його ID
router.delete('/:id', productController.deleteProduct);


// Маршрути для управління штрихкодами конкретного товару
// POST для додавання штрихкоду до товару
router.post('/:productId/barcodes', productController.addProductBarcode);

// DELETE для видалення штрихкоду у товару
router.delete('/:productId/barcodes/:barcodeId', productController.deleteProductBarcode);


module.exports = router;