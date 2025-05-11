// js/modules/uiSaleManager.js
import { 
    createSaleAPI, fetchSalesAPI, fetchSaleByIdAPI, 
    fetchStoresAPI, fetchUsersAPI, 
    getProductByIdAPI, findProductsByBarcodeAPI // Для пошуку товарів
} from './apiService.js';

let salesTableBody, apiResponseDiv;

// Нові змінні для модального вікна
let addNewSaleBtn, saleModal, saleModalTitle, closeSaleModalBtn, cancelSaleModalBtn,
    saleModalForm, modalSaleIdInput, modalSaleStoreIdSelect, modalSaleUserIdSelect,
    modalSalePaymentMethodSelect, modalSaleOverallDiscountInput,
    modalSaleItemsTableBody,
    modalSaleProductIdInput, modalSaleProductQtyInput, modalSaleProductPriceInput, modalSaleProductDiscountInput,
    addProductToSaleModalBtn,
    modalSaleTotalUnroundedSpan, modalSaleTotalWithDiscountSpan, modalSaleTotalRoundedSpan;

// Масив для зберігання товарів у поточному чеку в модалці
let currentSaleModalItems = [];

// Допоміжна функція округлення (можна винести в utils.js, якщо використовується в багатьох місцях)
function roundToNearest50Kop(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  return Math.round(amount * 2) / 2;
}

export function initSaleControls(responseDivElement) {
    apiResponseDiv = responseDivElement;
    salesTableBody = document.querySelector('#salesTable tbody');

    addNewSaleBtn = document.getElementById('addNewSaleBtn');
    saleModal = document.getElementById('saleModal');
    saleModalTitle = document.getElementById('saleModalTitle');
    closeSaleModalBtn = document.getElementById('closeSaleModalBtn');
    cancelSaleModalBtn = document.getElementById('cancelSaleModalBtn');
    saleModalForm = document.getElementById('saleModalForm');
    modalSaleIdInput = document.getElementById('modalSaleId'); // Поки не використовується для створення
    modalSaleStoreIdSelect = document.getElementById('modalSaleStoreId');
    modalSaleUserIdSelect = document.getElementById('modalSaleUserId');
    modalSalePaymentMethodSelect = document.getElementById('modalSalePaymentMethod');
    modalSaleOverallDiscountInput = document.getElementById('modalSaleOverallDiscount');
    modalSaleItemsTableBody = document.getElementById('modalSaleItemsTableBody');
    
    modalSaleProductIdInput = document.getElementById('modalSaleProductIdInput');
    modalSaleProductQtyInput = document.getElementById('modalSaleProductQtyInput');
    modalSaleProductPriceInput = document.getElementById('modalSaleProductPriceInput');
    modalSaleProductDiscountInput = document.getElementById('modalSaleProductDiscountInput');
    addProductToSaleModalBtn = document.getElementById('addProductToSaleModalBtn');

    modalSaleTotalUnroundedSpan = document.getElementById('modalSaleTotalUnrounded');
    modalSaleTotalWithDiscountSpan = document.getElementById('modalSaleTotalWithDiscount');
    modalSaleTotalRoundedSpan = document.getElementById('modalSaleTotalRounded');

    if (!salesTableBody || !addNewSaleBtn || !saleModal || !saleModalForm) {
        console.warn('Основні елементи для управління продажами (модальне вікно) не знайдені.');
        return;
    }

    addNewSaleBtn.addEventListener('click', openSaleModalForCreate);
    if (closeSaleModalBtn) closeSaleModalBtn.addEventListener('click', closeSaleModal);
    if (cancelSaleModalBtn) cancelSaleModalBtn.addEventListener('click', closeSaleModal);
    saleModalForm.addEventListener('submit', handleSaleModalSubmit);
    
    if (addProductToSaleModalBtn) {
        addProductToSaleModalBtn.addEventListener('click', handleAddProductToSaleModalTable);
    }
     // Обробник для зміни загальної знижки на чек для перерахунку
    if (modalSaleOverallDiscountInput) {
        modalSaleOverallDiscountInput.addEventListener('input', updateSaleModalTotals);
    }


    if (saleModal) {
        saleModal.addEventListener('click', (event) => {
            if (event.target === saleModal) {
                closeSaleModal();
            }
        });
    }
    
    populateSelectsForSaleModal(); // Заповнюємо магазини та користувачів у модалці
    setupSalesTableEventListeners(); // Для кнопки "Деталі" у списку чеків
}

async function populateSelectsForSaleModal() {
    // Заповнення магазинів
    if (modalSaleStoreIdSelect) {
        try {
            const stores = await fetchStoresAPI();
            modalSaleStoreIdSelect.innerHTML = '<option value="">-- Оберіть магазин --</option>';
            stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = store.name;
                modalSaleStoreIdSelect.appendChild(option);
            });
        } catch (error) { console.error("Помилка завантаження магазинів для модалки продажів:", error); }
    }
    // Заповнення користувачів (касирів)
    if (modalSaleUserIdSelect) {
        try {
            const users = await fetchUsersAPI();
            modalSaleUserIdSelect.innerHTML = '<option value="">-- Оберіть касира --</option>';
            users.forEach(user => {
                if (user.is_active && (user.role === 'cashier' || user.role === 'admin' || user.role === 'manager')) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.full_name || user.username} (ID: ${user.id})`;
                    modalSaleUserIdSelect.appendChild(option);
                }
            });
             // Автоматично вибрати поточного залогіненого користувача, якщо він є у списку
            const currentUserId = localStorage.getItem('userId');
            if (currentUserId && modalSaleUserIdSelect.querySelector(`option[value="${currentUserId}"]`)) {
                modalSaleUserIdSelect.value = currentUserId;
            }

        } catch (error) { console.error("Помилка завантаження користувачів для модалки продажів:", error); }
    }
}

function openSaleModalForCreate() {
    // Перевірка наявності ключових елементів модалки
    if (!saleModal || !saleModalForm || !modalSaleItemsTableBody || !modalSaleTotalRoundedSpan) {
         console.error("Елементи модального вікна продажу не ініціалізовані для створення."); return;
    }
    saleModalTitle.textContent = 'Створити Новий Чек';
    saleModalForm.reset();
    currentSaleModalItems = [];
    renderSaleModalItems(); // Очистить і оновить таблицю товарів
    // updateSaleModalTotals(); // renderSaleModalItems вже викликає це
    
    // Встановлення значень за замовчуванням (наприклад, поточний користувач)
    const currentUserId = localStorage.getItem('userId');
    if (currentUserId && modalSaleUserIdSelect.querySelector(`option[value="${currentUserId}"]`)) {
        modalSaleUserIdSelect.value = currentUserId;
    }
    // Можна також встановлювати магазин за замовчуванням, якщо є така логіка

    saleModal.style.display = 'block';
}

function closeSaleModal() {
    if(saleModal) saleModal.style.display = 'none';
}

// Візуалізація товарів у таблиці модального вікна продажу
function renderSaleModalItems() {
    if (!modalSaleItemsTableBody) return;
    modalSaleItemsTableBody.innerHTML = '';
    currentSaleModalItems.forEach((item, index) => {
        const row = modalSaleItemsTableBody.insertRow();
        const lineSubtotal = (parseFloat(item.quantity) * parseFloat(item.price_per_unit_sold) * (1 - (parseFloat(item.discount_percent) / 100))).toFixed(2);
        row.innerHTML = `
            <td>${escapeHTML(item.product_name)} (ID: ${item.product_id})</td>
            <td><input type="number" value="${item.quantity}" min="0.001" step="0.001" class="modal-sale-item-quantity" data-index="${index}"></td>
            <td><input type="number" value="${parseFloat(item.price_per_unit_sold).toFixed(2)}" min="0.00" step="0.01" class="modal-sale-item-price" data-index="${index}"></td>
            <td><input type="number" value="${parseFloat(item.discount_percent).toFixed(1)}" min="0" max="100" step="0.1" class="modal-sale-item-discount" data-index="${index}"></td>
            <td>${lineSubtotal}</td>
            <td>---</td> <!-- Собівартість буде на бекенді -->
            <td><button type="button" class="delete-btn remove-modal-sale-item-btn" data-index="${index}">X</button></td>
        `;
    });

    modalSaleItemsTableBody.querySelectorAll('.modal-sale-item-quantity, .modal-sale-item-price, .modal-sale-item-discount').forEach(input => {
        input.addEventListener('change', handleModalSaleItemChange);
    });
    modalSaleItemsTableBody.querySelectorAll('.remove-modal-sale-item-btn').forEach(button => {
        button.addEventListener('click', handleRemoveModalSaleItem);
    });
    updateSaleModalTotals();
}

// Обробник зміни кількості, ціни або знижки товару в модалці продажу
function handleModalSaleItemChange(event) {
    const index = parseInt(event.target.dataset.index);
    const itemToUpdate = currentSaleModalItems[index];
    if (!itemToUpdate) return;

    const targetClass = event.target.classList;
    let value = parseFloat(event.target.value);

    if (targetClass.contains('modal-sale-item-quantity')) {
        if (!isNaN(value) && value > 0) itemToUpdate.quantity = value;
        else { event.target.value = itemToUpdate.quantity; alert("Кількість має бути позитивним числом."); }
    } else if (targetClass.contains('modal-sale-item-price')) {
        if (!isNaN(value) && value >= 0) itemToUpdate.price_per_unit_sold = value;
        else { event.target.value = itemToUpdate.price_per_unit_sold.toFixed(2); alert("Ціна не може бути від'ємною."); }
    } else if (targetClass.contains('modal-sale-item-discount')) {
        if (!isNaN(value) && value >= 0 && value <= 100) itemToUpdate.discount_percent = value;
        else { event.target.value = itemToUpdate.discount_percent.toFixed(1); alert("Знижка має бути від 0 до 100."); }
    }
    renderSaleModalItems();
}

// Обробник видалення товару з таблиці в модалці продажу
function handleRemoveModalSaleItem(event) {
    const index = parseInt(event.target.dataset.index);
    currentSaleModalItems.splice(index, 1);
    renderSaleModalItems();
}

// Оновлення всіх сум у модальному вікні продажу
function updateSaleModalTotals() {
    if (!modalSaleTotalUnroundedSpan || !modalSaleTotalWithDiscountSpan || !modalSaleTotalRoundedSpan || !modalSaleOverallDiscountInput) return;

    let totalUnrounded = 0;
    let totalWithItemDiscounts = 0;

    currentSaleModalItems.forEach(item => {
        const itemPrice = parseFloat(item.price_per_unit_sold);
        const itemQuantity = parseFloat(item.quantity);
        const itemDiscount = parseFloat(item.discount_percent) / 100;

        totalUnrounded += itemPrice * itemQuantity;
        totalWithItemDiscounts += (itemPrice * (1 - itemDiscount)) * itemQuantity;
    });

    modalSaleTotalUnroundedSpan.textContent = totalUnrounded.toFixed(2);
    
    const overallDiscountPercent = parseFloat(modalSaleOverallDiscountInput.value) / 100 || 0;
    const totalAfterOverallDiscount = totalWithItemDiscounts * (1 - overallDiscountPercent);
    
    modalSaleTotalWithDiscountSpan.textContent = totalAfterOverallDiscount.toFixed(2);
    modalSaleTotalRoundedSpan.textContent = roundToNearest50Kop(totalAfterOverallDiscount).toFixed(2);
}

// Обробник додавання товару до чеку в модалці (поки що спрощений пошук)
async function handleAddProductToSaleModalTable() {
    if (!modalSaleProductIdInput || !modalSaleProductQtyInput || !modalSaleProductPriceInput || !modalSaleProductDiscountInput) return;

    const searchTerm = modalSaleProductIdInput.value.trim();
    const quantity = parseFloat(modalSaleProductQtyInput.value);
    let price = parseFloat(modalSaleProductPriceInput.value); // Може бути порожнім, тоді беремо з товару
    let discount = parseFloat(modalSaleProductDiscountInput.value) || 0;

    if (!searchTerm) { alert("Введіть ID, штрихкод або назву товару."); return; }
    if (isNaN(quantity) || quantity <= 0) { alert("Вкажіть коректну кількість."); return; }

    let foundProduct = null;
    try {
        // Спробуємо знайти за штрихкодом
        const productsByBarcode = await findProductsByBarcodeAPI(searchTerm);
        if (productsByBarcode && productsByBarcode.length > 0) {
            // Тут потрібна логіка вибору, якщо знайдено декілька. Поки беремо перший.
            // Або відкриваємо модалку вибору, як в uiCashierManager
            foundProduct = productsByBarcode[0]; // УВАГА: findProductsByBarcodeAPI повертає масив з розширеними даними
                                                // нам потрібен product.id, product.name, product.retail_price
            foundProduct = { // Приводимо до формату, схожого на getProductByIdAPI
                id: foundProduct.id,
                name: foundProduct.name,
                retail_price: foundProduct.retail_price 
            };

        }
    } catch (error) {
        // Якщо не знайдено за ШК, або сталася помилка, спробуємо за ID
        if (error.message.toLowerCase().includes('не знайдено') || error.status === 404) {
            if (!isNaN(parseInt(searchTerm))) { // Перевіряємо, чи searchTerm схожий на ID
                try {
                    foundProduct = await getProductByIdAPI(searchTerm);
                } catch (idError) {
                    alert(`Товар з ID або штрихкодом "${searchTerm}" не знайдено. ${idError.message}`);
                    return;
                }
            } else {
                 alert(`Товар зі штрихкодом "${searchTerm}" не знайдено.`);
                 return;
            }
        } else {
            alert(`Помилка пошуку товару: ${error.message}`);
            return;
        }
    }
     if (!foundProduct) {
        alert(`Товар з ID або штрихкодом "${searchTerm}" не знайдено.`);
        return;
    }

    // Якщо ціна не введена користувачем, беремо роздрібну ціну товару
    if (isNaN(price) || modalSaleProductPriceInput.value.trim() === '') {
        price = parseFloat(foundProduct.retail_price);
    }

    const existingItemIndex = currentSaleModalItems.findIndex(item => item.product_id === foundProduct.id);
    if (existingItemIndex !== -1) {
        // Товар вже є, оновлюємо кількість, ціну, знижку
        currentSaleModalItems[existingItemIndex].quantity += quantity; // Або замінюємо: = quantity;
        currentSaleModalItems[existingItemIndex].price_per_unit_sold = price;
        currentSaleModalItems[existingItemIndex].discount_percent = discount;
    } else {
        currentSaleModalItems.push({
            product_id: foundProduct.id,
            product_name: foundProduct.name,
            quantity: quantity,
            price_per_unit_sold: price,
            discount_percent: discount
        });
    }

    renderSaleModalItems();
    modalSaleProductIdInput.value = '';
    modalSaleProductQtyInput.value = '1';
    modalSaleProductPriceInput.value = '';
    modalSaleProductDiscountInput.value = '0';
    modalSaleProductIdInput.focus();
}

async function handleSaleModalSubmit(event) {
    event.preventDefault();
    if (currentSaleModalItems.length === 0) {
        alert('Додайте хоча б один товар у чек!'); return;
    }

    const saleData = {
        store_id: parseInt(modalSaleStoreIdSelect.value),
        user_id: parseInt(modalSaleUserIdSelect.value),
        payment_method: modalSalePaymentMethodSelect.value,
        overall_discount_percent: parseFloat(modalSaleOverallDiscountInput.value) || 0,
        items_sold: currentSaleModalItems.map(item => ({
            product_id: item.product_id,
            quantity: parseFloat(item.quantity),
            price_per_unit_sold: parseFloat(item.price_per_unit_sold),
            discount_percent: parseFloat(item.discount_percent) || 0
        }))
    };

    if (isNaN(saleData.store_id) || isNaN(saleData.user_id) || !saleData.payment_method) {
        alert('Оберіть магазин, касира та метод оплати!'); return;
    }

    try {
        const result = await createSaleAPI(saleData);
        if (apiResponseDiv) apiResponseDiv.textContent = `Чек ${result.checkNumber} успішно створено. ${result.message || ''}`;
        
        // Тут можна показати HTML чека, якщо result.checkHtmlContent є
        if (result.checkHtmlContent) {
            // Логіка для показу/друку чека (можна в новій вкладці або модалці)
            const printWindow = window.open('', '_blank');
            printWindow.document.write(result.checkHtmlContent);
            printWindow.document.close();
            printWindow.focus();
            // setTimeout(() => { printWindow.print(); }, 500); // Затримка для завантаження стилів
        }

        closeSaleModal();
        loadSales(); // Оновлюємо список чеків
        if (typeof loadAllPurchaseItems === 'function') { // Якщо ця функція існує (з uiPurchaseManager)
            loadAllPurchaseItems(); // Оновлюємо залишки партій
        }
    } catch (error) {
        console.error('Помилка створення чека:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка створення чека: ${error.message}`;
        alert(`Помилка: ${error.message}`);
    }
}

// Функції loadSales, viewSaleDetails, setupSalesTableEventListeners, escapeHTML
// залишаються в основному такими ж. viewSaleDetails може потребувати оновлення,
// якщо ви хочете відображати собівартість, розраховану на бекенді.
// Я скопіюю їх з вашого поточного файлу для повноти.

export async function loadSales() {
    if (!salesTableBody) return;
    try {
        const sales = await fetchSalesAPI();
        salesTableBody.innerHTML = '';
        sales.forEach(sale => {
            const row = salesTableBody.insertRow();
            row.innerHTML = `
                <td>${sale.id}</td>
                <td>${escapeHTML(sale.check_number_display)}</td>
                <td>${new Date(sale.sale_timestamp).toLocaleString('uk-UA')}</td>
                <td>${escapeHTML(sale.store_name)} (ID: ${sale.store_id})</td>
                <td>${escapeHTML(sale.user_name)} (ID: ${sale.user_id})</td>
                <td>${parseFloat(sale.total_amount_rounded).toFixed(2)}</td>
                <td>${escapeHTML(sale.payment_method)}</td>
                <td>
                    <button class="view-btn" data-action="view-sale-details" data-id="${sale.id}">Деталі</button>
                </td>
            `;
        });
        if (apiResponseDiv) apiResponseDiv.textContent = 'Список чеків оновлено.';
    } catch (error) {
        console.error('Помилка завантаження чеків:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження чеків: ${error.message}`;
    }
}

async function viewSaleDetails(saleId) {
    try {
        const saleDoc = await fetchSaleByIdAPI(saleId);
        let detailsHtml = `<h3>Деталі Чека ID: ${saleDoc.id} (№ ${escapeHTML(saleDoc.check_number_display)})</h3>
                           <p>Дата: ${new Date(saleDoc.sale_timestamp).toLocaleString('uk-UA')}</p>
                           <p>Магазин: ${escapeHTML(saleDoc.store_name)} (ID: ${saleDoc.store_id})</p>
                           <p>Касир: ${escapeHTML(saleDoc.user_name)} (ID: ${saleDoc.user_id})</p>
                           <p>Метод оплати: ${escapeHTML(saleDoc.payment_method)}</p>
                           <p>Сума до округлення: ${parseFloat(saleDoc.total_amount_unrounded).toFixed(2)}</p>
                           <p>Загальна сума (округлена): ${parseFloat(saleDoc.total_amount_rounded).toFixed(2)}</p>
                           <p>Загальна знижка на чек: ${saleDoc.overall_discount_percent}%</p>
                           <h4>Товари:</h4><ul>`;
        saleDoc.items.forEach(item => {
            detailsHtml += `<li>${escapeHTML(item.product_name)} (ID: ${item.product_id}, ШК: ${escapeHTML(item.product_barcode || 'N/A')}) <br>
                                 К-сть: ${item.quantity}, 
                              Ціна: ${parseFloat(item.price_per_unit_sold).toFixed(2)}, 
                              Знижка: ${item.discount_percent}%, 
                              Сума рядка: ${parseFloat(item.total_line_amount).toFixed(2)}, 
                              Собівартість FIFO: ${parseFloat(item.cost_of_goods_sold_fifo).toFixed(2)}</li><br>`;
        });
        detailsHtml += `</ul>`;
        if (apiResponseDiv) apiResponseDiv.innerHTML = detailsHtml;
    } catch (error) {
        console.error('Помилка завантаження деталей чека:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження деталей чека: ${error.message}`;
    }
}

export function setupSalesTableEventListeners() {
    if (salesTableBody) {
        salesTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="view-sale-details"]');
            if (button) {
                const saleId = button.dataset.id;
                viewSaleDetails(saleId);
            }
        });
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
            case "\'": return '\'';
            default: return match;
        }
    });
}