// your-project-root/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Застосовуємо authenticateToken до всіх маршрутів у цьому файлі
router.use(authenticateToken);

// GET для отримання всіх товарів (з пагінацією)
router.get('/', productController.getAllProducts);

// GET для пошуку товарів (для автодоповнення)
// Цей маршрут має йти перед більш загальними маршрутами з параметрами, щоб уникнути конфліктів,
// наприклад, щоб "search" не сприймалося як ":id" або ":barcodeValue".
router.get('/search', productController.searchProductsByNameOrBarcode);

// GET для пошуку товарів за конкретним значенням штрихкоду
router.get('/by-barcode/:barcodeValue', productController.findProductsByBarcode);

// GET для отримання залишків конкретного товару по магазинах/партіях
router.get('/:productId/stock-by-stores', productController.getProductStockByStores);

// GET для отримання конкретного товару за його ID
router.get('/:id', productController.getProductById); // Цей маршрут має йти після більш специфічних як /search

// POST для створення нового товару
router.post('/', authorizeRole(['admin', 'manager']), productController.createProduct);

// POST для імпорту товарів з файлу
router.post('/import', authorizeRole(['admin', 'manager']), productController.importProducts);

// PUT для оновлення існуючого товару за його ID
router.put('/:id', authorizeRole(['admin', 'manager']), productController.updateProduct);

// DELETE для видалення товару за його ID
router.delete('/:id', authorizeRole(['admin', 'manager']), productController.deleteProduct);

// Маршрути для управління штрихкодами конкретного товару
// POST для додавання штрихкоду до товару
router.post('/:productId/barcodes', authorizeRole(['admin', 'manager']), productController.addProductBarcode);

// DELETE для видалення штрихкоду у товару
router.delete('/:productId/barcodes/:barcodeId', authorizeRole(['admin', 'manager']), productController.deleteProductBarcode);

module.exports = router;