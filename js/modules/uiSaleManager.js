// js/modules/uiSaleManager.js
import { 
    createSaleAPI, fetchSalesAPI, fetchSaleByIdAPI, 
    fetchStoresAPI, fetchUsersAPI, 
    getProductByIdAPI, findProductsByBarcodeAPI 
} from './apiService.js';

let salesTableBody, apiResponseDiv;

// Елементи модального вікна
let addNewSaleBtn, saleModal, saleModalTitle, closeSaleModalBtn, cancelSaleModalBtn,
    saleModalForm, modalSaleIdInput, modalSaleStoreIdSelect, modalSaleUserIdSelect,
    modalSalePaymentMethodSelect, modalSaleOverallDiscountInput,
    modalSaleItemsTableBody,
    modalSaleProductIdInput, modalSaleProductQtyInput, modalSaleProductPriceInput, modalSaleProductDiscountInput,
    addProductToSaleModalBtn,
    modalSaleTotalUnroundedSpan, modalSaleTotalWithDiscountSpan, modalSaleTotalRoundedSpan;

let currentSaleModalItems = [];

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
    modalSaleIdInput = document.getElementById('modalSaleId');
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
    
    populateSelectsForSaleModal(); 
    setupSalesTableEventListeners();
}

async function populateSelectsForSaleModal() {
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
            const currentUserId = localStorage.getItem('userId');
            if (currentUserId && modalSaleUserIdSelect.querySelector(`option[value="${currentUserId}"]`)) {
                modalSaleUserIdSelect.value = currentUserId;
            }
        } catch (error) { console.error("Помилка завантаження користувачів для модалки продажів:", error); }
    }
}

function setSaleFormReadOnly(isReadOnly) {
    if (modalSaleStoreIdSelect) modalSaleStoreIdSelect.disabled = isReadOnly;
    if (modalSaleUserIdSelect) modalSaleUserIdSelect.disabled = isReadOnly;
    if (modalSalePaymentMethodSelect) modalSalePaymentMethodSelect.disabled = isReadOnly;
    if (modalSaleOverallDiscountInput) modalSaleOverallDiscountInput.readOnly = isReadOnly;

    const addProductSection = modalSaleProductIdInput?.closest('div[style*="display: flex"]');
    if (addProductSection) addProductSection.style.display = isReadOnly ? 'none' : 'flex';
    
    const submitButton = saleModalForm?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.style.display = isReadOnly ? 'none' : 'inline-block';

    modalSaleItemsTableBody.querySelectorAll('input').forEach(input => {
        input.readOnly = isReadOnly;
    });
    modalSaleItemsTableBody.querySelectorAll('.remove-modal-sale-item-btn').forEach(button => {
        button.style.display = isReadOnly ? 'none' : 'inline-block';
    });
}

async function openSaleModalForView(saleId) {
    if (!saleModal || !saleModalForm || !modalSaleItemsTableBody || !modalSaleTotalRoundedSpan) {
        console.error("Елементи модального вікна продажу не ініціалізовані для перегляду."); return;
    }
    
    try {
        if (apiResponseDiv) apiResponseDiv.textContent = `Завантаження деталей чека ID: ${saleId}...`;
        const saleDoc = await fetchSaleByIdAPI(saleId);
        if (!saleDoc) {
            if (apiResponseDiv) apiResponseDiv.textContent = `Не вдалося завантажити чек ID: ${saleId}.`;
            alert(`Не вдалося завантажити чек ID: ${saleId}.`);
            return;
        }

        saleModalTitle.textContent = `Деталі Чека № ${escapeHTML(saleDoc.check_number_display)} (ID: ${saleDoc.id})`;
        saleModalForm.reset(); 
        modalSaleIdInput.value = saleDoc.id; // Зберігаємо ID чеку

        // Заповнення шапки
        await populateSelectsForSaleModal(); // Перезаповнюємо та вибираємо
        modalSaleStoreIdSelect.value = saleDoc.store_id;
        modalSaleUserIdSelect.value = saleDoc.user_id;
        modalSalePaymentMethodSelect.value = saleDoc.payment_method;
        modalSaleOverallDiscountInput.value = saleDoc.overall_discount_percent || 0;

        // Заповнення товарів
        currentSaleModalItems = saleDoc.items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: parseFloat(item.quantity),
            price_per_unit_sold: parseFloat(item.price_per_unit_sold),
            discount_percent: parseFloat(item.discount_percent) || 0,
            // Собівартість тут не редагується, лише для інформації, якщо потрібно буде відобразити
            cost_of_goods_sold_fifo: parseFloat(item.cost_of_goods_sold_fifo) 
        }));
        
        setSaleFormReadOnly(true); // Режим "тільки для читання"
        renderSaleModalItems();    // Відображаємо товари (врахує readOnly)
        
        saleModal.style.display = 'block';
        if (apiResponseDiv) apiResponseDiv.textContent = `Відображено деталі чека ID: ${saleDoc.id}.`;

    } catch (error) {
        console.error(`Помилка відкриття деталей чека ID ${saleId}:`, error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка: ${error.message}`;
        alert(`Помилка завантаження деталей чека: ${error.message}`);
    }
}

function openSaleModalForCreate() {
    if (!saleModal || !saleModalForm || !modalSaleItemsTableBody || !modalSaleTotalRoundedSpan) {
         console.error("Елементи модального вікна продажу не ініціалізовані для створення."); return;
    }
    saleModalTitle.textContent = 'Створити Новий Чек';
    saleModalForm.reset();
    modalSaleIdInput.value = ''; // Немає ID для нового чеку
    currentSaleModalItems = [];
    
    setSaleFormReadOnly(false); // Режим редагування/створення
    renderSaleModalItems();
    
    const currentUserId = localStorage.getItem('userId');
    if (currentUserId && modalSaleUserIdSelect.querySelector(`option[value="${currentUserId}"]`)) {
        modalSaleUserIdSelect.value = currentUserId;
    }
    const defaultStoreId = localStorage.getItem('storeId'); // Можна спробувати встановити магазин за замовчуванням
    if (defaultStoreId && modalSaleStoreIdSelect.querySelector(`option[value="${defaultStoreId}"]`)) {
        modalSaleStoreIdSelect.value = defaultStoreId;
    }


    saleModal.style.display = 'block';
    if (apiResponseDiv) apiResponseDiv.textContent = "Форма для створення нового чеку готова.";
}

function closeSaleModal() {
    if(saleModal) saleModal.style.display = 'none';
    currentSaleModalItems = [];
    if (apiResponseDiv) apiResponseDiv.textContent = "Модальне вікно продажу закрито.";
}

function renderSaleModalItems() {
    if (!modalSaleItemsTableBody) return;
    const isReadOnly = modalSaleStoreIdSelect?.disabled || false; // Визначаємо режим форми

    modalSaleItemsTableBody.innerHTML = '';
    currentSaleModalItems.forEach((item, index) => {
        const row = modalSaleItemsTableBody.insertRow();
        const lineSubtotal = (parseFloat(item.quantity) * parseFloat(item.price_per_unit_sold) * (1 - (parseFloat(item.discount_percent) / 100))).toFixed(2);
        const costFifoDisplay = item.cost_of_goods_sold_fifo ? parseFloat(item.cost_of_goods_sold_fifo).toFixed(2) : '---';

        row.innerHTML = `
            <td>${escapeHTML(item.product_name)} (ID: ${item.product_id})</td>
            <td><input type="number" value="${item.quantity}" min="0.001" step="0.001" class="modal-sale-item-quantity" data-index="${index}" ${isReadOnly ? 'readonly' : ''}></td>
            <td><input type="number" value="${parseFloat(item.price_per_unit_sold).toFixed(2)}" min="0.00" step="0.01" class="modal-sale-item-price" data-index="${index}" ${isReadOnly ? 'readonly' : ''}></td>
            <td><input type="number" value="${parseFloat(item.discount_percent).toFixed(1)}" min="0" max="100" step="0.1" class="modal-sale-item-discount" data-index="${index}" ${isReadOnly ? 'readonly' : ''}></td>
            <td>${lineSubtotal}</td>
            <td>${costFifoDisplay}</td>
            <td><button type="button" class="delete-btn remove-modal-sale-item-btn" data-index="${index}" style="display: ${isReadOnly ? 'none' : 'inline-block'};">X</button></td>
        `;
    });

    if (!isReadOnly) {
        modalSaleItemsTableBody.querySelectorAll('.modal-sale-item-quantity, .modal-sale-item-price, .modal-sale-item-discount').forEach(input => {
            input.addEventListener('change', handleModalSaleItemChange);
        });
        modalSaleItemsTableBody.querySelectorAll('.remove-modal-sale-item-btn').forEach(button => {
            button.addEventListener('click', handleRemoveModalSaleItem);
        });
    }
    updateSaleModalTotals();
}

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

function handleRemoveModalSaleItem(event) {
    const index = parseInt(event.target.dataset.index);
    currentSaleModalItems.splice(index, 1);
    renderSaleModalItems();
}

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

async function handleAddProductToSaleModalTable() {
    // ... (код залишається таким же, як у вашій попередній версії) ...
    if (!modalSaleProductIdInput || !modalSaleProductQtyInput || !modalSaleProductPriceInput || !modalSaleProductDiscountInput) return;
    const searchTerm = modalSaleProductIdInput.value.trim();
    const quantity = parseFloat(modalSaleProductQtyInput.value);
    let price = parseFloat(modalSaleProductPriceInput.value);
    let discount = parseFloat(modalSaleProductDiscountInput.value) || 0;

    if (!searchTerm) { alert("Введіть ID, штрихкод або назву товару."); return; }
    if (isNaN(quantity) || quantity <= 0) { alert("Вкажіть коректну кількість."); return; }

    let foundProductData = null;
    try {
        const productsByBarcode = await findProductsByBarcodeAPI(searchTerm);
        if (productsByBarcode && productsByBarcode.length > 0) {
            if (productsByBarcode.length === 1) {
                foundProductData = productsByBarcode[0];
            } else {
                // Тут можна реалізувати модалку вибору, якщо знайдено декілька за ШК
                alert(`Знайдено декілька товарів за штрихкодом "${searchTerm}". Оберіть один (поки не реалізовано).`);
                return;
            }
        }
    } catch (error) {
        if (!error.message.toLowerCase().includes('не знайдено') && error.status !== 404) {
             console.warn(`Помилка пошуку за ШК "${searchTerm}": ${error.message}. Спроба пошуку за ID.`);
        }
    }

    if (!foundProductData && !isNaN(parseInt(searchTerm))) {
        try {
            const productById = await getProductByIdAPI(searchTerm);
            if (productById) {
                 foundProductData = { // Приводимо до спільного формату
                    id: productById.id,
                    name: productById.name,
                    retail_price: productById.retail_price
                };
            }
        } catch (idError) { /* ігноруємо, якщо за ID не знайдено */ }
    }
    
    if (!foundProductData) {
        alert(`Товар з ID або штрихкодом "${searchTerm}" не знайдено.`); return;
    }

    if (isNaN(price) || modalSaleProductPriceInput.value.trim() === '') {
        price = parseFloat(foundProductData.retail_price);
    }

    const existingItemIndex = currentSaleModalItems.findIndex(item => item.product_id === foundProductData.id);
    if (existingItemIndex !== -1) {
        currentSaleModalItems[existingItemIndex].quantity += quantity;
        currentSaleModalItems[existingItemIndex].price_per_unit_sold = price; // Можна оновлювати ціну і знижку
        currentSaleModalItems[existingItemIndex].discount_percent = discount;
    } else {
        currentSaleModalItems.push({
            product_id: foundProductData.id,
            product_name: foundProductData.name,
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
    const saleDocId = modalSaleIdInput.value;
    if (saleDocId) { // Якщо є ID, це режим перегляду, не зберігаємо
        alert("Форма відкрита в режимі перегляду. Збереження неможливе.");
        return;
    }

    if (currentSaleModalItems.length === 0) { alert('Додайте хоча б один товар у чек!'); return; }
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
        if (result.checkHtmlContent) {
            const printWindow = window.open('', '_blank', 'width=300,height=600,scrollbars=yes,resizable=yes');
            if (printWindow) {
                printWindow.document.write(result.checkHtmlContent);
                printWindow.document.close();
                printWindow.focus();
                // setTimeout(() => { try { printWindow.print(); } catch(e){ console.error(e); } }, 500);
            } else {
                alert("Не вдалося відкрити вікно для друку. Перевірте блокувальник спливаючих вікон.");
            }
        }
        closeSaleModal();
        loadSales(); 
        // Оновлення залишків партій, якщо ця функція імпортована та доступна
        if (typeof loadAllPurchaseItems === 'function') {
            loadAllPurchaseItems();
        }
    } catch (error) {
        console.error('Помилка створення чека:', error);
        const errorMessage = error.message || (typeof error === 'string' ? error : "Невідома помилка сервера.");
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка створення чека: ${errorMessage}`;
        alert(`Помилка: ${errorMessage}`);
    }
}

export async function loadSales() {
    // ... (код залишається таким же) ...
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

// Стара функція viewSaleDetails, яка виводила HTML в apiResponseDiv, тепер не потрібна.
// Замість неї буде openSaleModalForView.

export function setupSalesTableEventListeners() {
    if (salesTableBody) {
        salesTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="view-sale-details"]');
            if (button) {
                const saleId = button.dataset.id;
                openSaleModalForView(saleId); // Викликаємо відкриття модалки для перегляду
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