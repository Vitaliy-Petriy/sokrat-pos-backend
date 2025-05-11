// js/modules/uiCashierManager.js
import { findProductsByBarcodeAPI, createSaleAPI, getProductByIdAPI } from './apiService.js'; // getProductByIdAPI може знадобитися

// Змінні для DOM-елементів
let barcodeScanInput, findProductBtn, foundProductsContainer,
    checkItemsTableBody, totalAmountSpan, paymentMethodSelect, createSaleBtn,
    apiCashierResponseDiv,
    selectProductModal, modalProductList, closeSelectProductModalBtn;

// Масив для зберігання товарів у поточному чеку
let currentCheckItems = []; 
// Поточний касир та магазин (поки що заглушки, потім можна буде отримувати при логіні)
let currentCashier = { id: 1, name: "Тест Касир" }; // Заглушка
let currentStore = { id: 1, name: "Тест Магазин" }; // Заглушка

export function initCashierControls(responseDiv) {
    barcodeScanInput = document.getElementById('barcodeScanInput');
    findProductBtn = document.getElementById('findProductBtn');
    foundProductsContainer = document.getElementById('foundProductsContainer');
    checkItemsTableBody = document.querySelector('#checkItemsTable tbody');
    totalAmountSpan = document.getElementById('totalAmount');
    paymentMethodSelect = document.getElementById('paymentMethodSelect');
    createSaleBtn = document.getElementById('createSaleBtn');
    apiCashierResponseDiv = responseDiv;

    // Модальне вікно
    selectProductModal = document.getElementById('selectProductModal');
    modalProductList = document.getElementById('modalProductList');
    closeSelectProductModalBtn = document.getElementById('closeSelectProductModalBtn');


    if (!barcodeScanInput || !findProductBtn || !foundProductsContainer || !checkItemsTableBody || 
        !totalAmountSpan || !paymentMethodSelect || !createSaleBtn || !selectProductModal) {
        console.error("Критична помилка: не всі елементи DOM для касира знайдені!");
        return;
    }
    
    // Обробники подій
    findProductBtn.addEventListener('click', handleFindProduct);
    barcodeScanInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Запобігаємо стандартній відправці форми, якщо інпут всередині форми
            handleFindProduct();
        }
    });

    foundProductsContainer.addEventListener('click', handleAddToCheckFromFound);
    checkItemsTableBody.addEventListener('input', handleQuantityChange); // Для інпутів кількості
    checkItemsTableBody.addEventListener('click', handleRemoveItemFromCheck); // Для кнопок видалення
    
    createSaleBtn.addEventListener('click', handleCreateSale);

    if (closeSelectProductModalBtn) {
        closeSelectProductModalBtn.addEventListener('click', () => selectProductModal.style.display = "none");
    }
    window.addEventListener('click', (event) => { // Закриття модалки по кліку поза нею
        if (event.target == selectProductModal) {
            selectProductModal.style.display = "none";
        }
    });


    // Оновлення інформації про касира та магазин (поки що заглушки)
    const currentCashierNameSpan = document.getElementById('currentCashierName');
    const currentStoreNameSpan = document.getElementById('currentStoreName');
    if (currentCashierNameSpan) currentCashierNameSpan.textContent = currentCashier.name;
    if (currentStoreNameSpan) currentStoreNameSpan.textContent = currentStore.name;

    updateCheckDisplay(); // Початкове оновлення відображення чека (має бути порожнім)
    barcodeScanInput.focus(); // Фокус на полі вводу штрихкоду
    console.log("Інтерфейс касира ініціалізовано.");
}

// --- Логіка Пошуку Товару ---
async function handleFindProduct() {
    const barcodeValue = barcodeScanInput.value.trim();
    if (!barcodeValue) {
        setApiResponse("Введіть штрихкод або назву для пошуку.", "error");
        return;
    }
    setApiResponse("Пошук товару...", "");

    try {
        const products = await findProductsByBarcodeAPI(barcodeValue); // API має повертати масив
        displayFoundProducts(products);
        barcodeScanInput.value = ''; // Очищуємо поле після пошуку
        barcodeScanInput.focus();
    } catch (error) {
        console.error("Помилка пошуку товару:", error);
        setApiResponse(`Помилка пошуку: ${error.message}`, "error");
        foundProductsContainer.innerHTML = '<p style="color: red;">Товар не знайдено або сталася помилка.</p>';
    }
}

function displayFoundProducts(products) {
    foundProductsContainer.innerHTML = ''; // Очищуємо попередні результати
    if (!products || products.length === 0) {
        foundProductsContainer.innerHTML = '<p>Товарів за цим запитом не знайдено.</p>';
        return;
    }

    if (products.length === 1) {
        // Якщо знайдено один товар, одразу додаємо його в чек
        addProductToCheck(products[0]);
    } else {
        // Якщо знайдено декілька товарів, показуємо модальне вікно для вибору
        modalProductList.innerHTML = ''; // Очищуємо список у модалці
        products.forEach(product => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('modal-product-item');
            itemDiv.textContent = `${product.name} (Ціна: ${parseFloat(product.retail_price).toFixed(2)} грн)`;
            itemDiv.dataset.productId = product.id; // Зберігаємо ID товару
            // Додаємо інші data-атрибути, якщо потрібно (ціна, назва)
            itemDiv.dataset.productName = product.name;
            itemDiv.dataset.productPrice = product.retail_price;

            itemDiv.addEventListener('click', () => {
                addProductToCheck({
                    id: product.id, // Використовуємо product_id, який приходить з findProductsByBarcode
                    name: product.name,
                    retail_price: product.retail_price
                    // `unit` та інші поля, якщо вони повертаються findProductsByBarcode
                });
                selectProductModal.style.display = "none";
            });
            modalProductList.appendChild(itemDiv);
        });
        selectProductModal.style.display = "block";
    }
}

// Обробник для кнопки "Додати в чек" з контейнера знайдених товарів (якщо б він був)
// Зараз ми або одразу додаємо, або через модалку
function handleAddToCheckFromFound(event) {
    if (event.target.classList.contains('add-to-check-btn')) {
        const productId = event.target.dataset.productId;
        // Потрібно отримати деталі товару за productId, якщо вони не передані повністю
        // Для простоти, припустимо, що displayFoundProducts вже передає достатньо даних
        // або ми можемо зробити ще один запит getProductByIdAPI(productId)
        // Або, що краще, findProductsByBarcodeAPI має повертати всі необхідні дані
        const productName = event.target.dataset.productName || "Невідомий товар";
        const productPrice = parseFloat(event.target.dataset.productPrice || "0");

        addProductToCheck({ id: parseInt(productId), name: productName, retail_price: productPrice });
    }
}


// --- Логіка Роботи з Чеком ---
function addProductToCheck(product) {
    if (!product || product.id === undefined) {
        console.error("Спроба додати невалідний товар в чек:", product);
        return;
    }
    // Перевіряємо, чи такий товар вже є в чеку
    const existingItem = currentCheckItems.find(item => item.productId === product.id);

    if (existingItem) {
        existingItem.quantity += 1; // Просто збільшуємо кількість
    } else {
        currentCheckItems.push({
            productId: product.id,
            name: product.name,
            price: parseFloat(product.retail_price), // Ціна за одиницю
            quantity: 1,
            unit: product.unit || 'шт' // Якщо є
        });
    }
    updateCheckDisplay();
    setApiResponse(`Товар "${product.name}" додано/оновлено в чеку.`, "success");
}

function updateCheckDisplay() {
    if (!checkItemsTableBody || !totalAmountSpan) return;

    checkItemsTableBody.innerHTML = ''; // Очищуємо таблицю чека
    let currentTotal = 0;

    currentCheckItems.forEach((item, index) => {
        const row = checkItemsTableBody.insertRow();
        const itemSubtotal = item.quantity * item.price;
        currentTotal += itemSubtotal;

        row.innerHTML = `
            <td>${escapeHTML(item.name)}</td>
            <td class="item-quantity"><input type="number" value="${item.quantity}" min="0.01" step="0.01" data-index="${index}"></td>
            <td>${item.price.toFixed(2)}</td>
            <td>${itemSubtotal.toFixed(2)}</td>
            <td class="item-actions"><button class="danger-btn remove-from-check-btn" data-index="${index}">X</button></td>
        `;
    });
    totalAmountSpan.textContent = `${currentTotal.toFixed(2)} грн`;
}

function handleQuantityChange(event) {
    if (event.target.tagName === 'INPUT' && event.target.type === 'number') {
        const index = parseInt(event.target.dataset.index);
        const newQuantity = parseFloat(event.target.value);

        if (!isNaN(newQuantity) && newQuantity >= 0 && index < currentCheckItems.length) {
            if (newQuantity === 0) { // Якщо кількість 0, видаляємо товар
                currentCheckItems.splice(index, 1);
            } else {
                currentCheckItems[index].quantity = newQuantity;
            }
            updateCheckDisplay();
        } else {
            // Якщо введено некоректне значення, повертаємо старе або мінімальне
            event.target.value = currentCheckItems[index] ? currentCheckItems[index].quantity : 1;
        }
    }
}

function handleRemoveItemFromCheck(event) {
    if (event.target.classList.contains('remove-from-check-btn')) {
        const index = parseInt(event.target.dataset.index);
        if (index >= 0 && index < currentCheckItems.length) {
            const removedItemName = currentCheckItems[index].name;
            currentCheckItems.splice(index, 1); // Видаляємо товар з масиву
            updateCheckDisplay();
            setApiResponse(`Товар "${removedItemName}" видалено з чеку.`, "");
        }
    }
}

async function handleCreateSale() {
    if (currentCheckItems.length === 0) {
        setApiResponse("Чек порожній. Додайте товари.", "error");
        return;
    }

    const saleData = {
        store_id: currentStore.id, // Поки що заглушка
        user_id: currentCashier.id, // Поки що заглушка
        payment_method: paymentMethodSelect.value,
        overall_discount_percent: 0, // Поки без загальної знижки
        items_sold: currentCheckItems.map(item => ({
            product_id: item.productId,
            quantity: item.quantity,
            price_per_unit_sold: item.price, // Використовуємо ціну, за якою додали в чек
            discount_percent: 0 // Поки без індивідуальних знижок на товар
        }))
    };

    setApiResponse("Створення чека...", "");
    try {
        const result = await createSaleAPI(saleData);
        setApiResponse(`Чек №${result.checkNumber} успішно створено! Сума: ${parseFloat(result.saleDetails?.total_amount_rounded || 0).toFixed(2)} грн.`, "success");
        // Очищення чека
        currentCheckItems = [];
        updateCheckDisplay();
        barcodeScanInput.focus();
        // Тут можна викликати друк чека, якщо result.checkHtmlContent є
        // if (result.checkHtmlContent) { printRawHtml(result.checkHtmlContent); }

    } catch (error) {
        console.error("Помилка створення чека:", error);
        setApiResponse(`Помилка створення чека: ${error.message}`, "error");
    }
}

// --- Допоміжні функції ---
function setApiResponse(message, type = "") { // type може бути "success" або "error"
    if (apiCashierResponseDiv) {
        apiCashierResponseDiv.textContent = message;
        apiCashierResponseDiv.className = ''; // Скидаємо класи
        if (type) {
            apiCashierResponseDiv.classList.add(type);
        }
    }
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&': return '&';
            case '<': return '<';
            case '>': return '>';
            case '"': return '"';
            case '\'': return '\'';
            default: return match;
        }
    });
}

// Функція для простого друку HTML (якщо знадобиться)
/*
function printRawHtml(htmlContent) {
    const printWindow = window.open('', '_blank', 'width=300,height=500,scrollbars=yes,resizable=yes');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
            try {
                printWindow.focus();
                printWindow.print();
            } catch (e) { console.error("Print error:", e); }
        }, 500);
    } else {
        alert("Не вдалося відкрити вікно для друку.");
    }
}
*/