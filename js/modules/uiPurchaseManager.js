// js/modules/uiPurchaseManager.js
import { createPurchaseAPI, fetchPurchasesAPI, fetchPurchaseByIdAPI, fetchAllPurchaseItemsAPI, fetchStoresAPI, fetchProductsAPI, getProductByIdAPI } from './apiService.js'; // Додаємо getProductByIdAPI

// Старі змінні для форми (деякі будуть видалені або замінені)
// let purchaseDocumentForm, purchaseDocIdInput, purchaseDocStoreIdSelect, purchaseDocDateInput,
//     purchaseDocNumberInput, purchaseDocItemsContainer;

let purchasesTableBody, purchaseItemsTableBody, apiResponseDiv;

// Нові змінні для модального вікна
let addNewPurchaseDocBtn, purchaseModal, purchaseModalTitle, closePurchaseModalBtn, cancelPurchaseModalBtn,
    purchaseModalForm, modalPurchaseDocIdInput, modalPurchaseStoreIdSelect, modalPurchaseDateInput,
    modalPurchaseDocNumberInput, modalPurchaseItemsTableBody,
    modalPurchaseProductIdInput, modalPurchaseProductQtyInput, modalPurchaseProductPriceInput, addProductToPurchaseModalBtn,
    modalPurchaseTotalAmountSpan;

// Масив для зберігання товарів у поточному документі в модалці
let currentPurchaseModalItems = [];

export function initPurchaseControls(responseDivElement) {
    apiResponseDiv = responseDivElement;
    purchasesTableBody = document.querySelector('#purchasesTable tbody');
    purchaseItemsTableBody = document.querySelector('#purchaseItemsTable tbody');

    // Ініціалізація елементів модального вікна
    addNewPurchaseDocBtn = document.getElementById('addNewPurchaseDocBtn');
    purchaseModal = document.getElementById('purchaseModal');
    purchaseModalTitle = document.getElementById('purchaseModalTitle');
    closePurchaseModalBtn = document.getElementById('closePurchaseModalBtn');
    cancelPurchaseModalBtn = document.getElementById('cancelPurchaseModalBtn');
    purchaseModalForm = document.getElementById('purchaseModalForm');
    modalPurchaseDocIdInput = document.getElementById('modalPurchaseDocId');
    modalPurchaseStoreIdSelect = document.getElementById('modalPurchaseStoreId');
    modalPurchaseDateInput = document.getElementById('modalPurchaseDate');
    modalPurchaseDocNumberInput = document.getElementById('modalPurchaseDocNumber');
    modalPurchaseItemsTableBody = document.getElementById('modalPurchaseItemsTableBody');
    
    modalPurchaseProductIdInput = document.getElementById('modalPurchaseProductIdInput');
    modalPurchaseProductQtyInput = document.getElementById('modalPurchaseProductQtyInput');
    modalPurchaseProductPriceInput = document.getElementById('modalPurchaseProductPriceInput');
    addProductToPurchaseModalBtn = document.getElementById('addProductToPurchaseModalBtn');
    modalPurchaseTotalAmountSpan = document.getElementById('modalPurchaseTotalAmount');


    if (!purchasesTableBody || !purchaseItemsTableBody || !addNewPurchaseDocBtn || !purchaseModal || !purchaseModalForm) {
        console.warn('Основні елементи для управління закупівлями (модальне вікно) не знайдені.');
        return;
    }

    addNewPurchaseDocBtn.addEventListener('click', openPurchaseModalForCreate);
    if (closePurchaseModalBtn) closePurchaseModalBtn.addEventListener('click', closePurchaseModal);
    if (cancelPurchaseModalBtn) cancelPurchaseModalBtn.addEventListener('click', closePurchaseModal);
    purchaseModalForm.addEventListener('submit', handlePurchaseModalSubmit);
    
    if (addProductToPurchaseModalBtn) {
        addProductToPurchaseModalBtn.addEventListener('click', handleAddProductToModalTable);
    }

    if (purchaseModal) {
        purchaseModal.addEventListener('click', (event) => {
            if (event.target === purchaseModal) {
                closePurchaseModal();
            }
        });
    }
    
    // Кнопка для оновлення списку всіх партій (залишається)
    const fetchAllPurchaseItemsBtn = document.getElementById('fetchAllPurchaseItemsBtn');
    if (fetchAllPurchaseItemsBtn) {
        fetchAllPurchaseItemsBtn.addEventListener('click', loadAllPurchaseItems);
    }
    
    populateStoreSelect(modalPurchaseStoreIdSelect); // Заповнюємо select магазинів у модалці
    setupPurchasesTableEventListeners(); // Для кнопки "Деталі" у списку документів
}

async function populateStoreSelect(selectElement) {
    if (!selectElement) return;
    try {
        const stores = await fetchStoresAPI();
        selectElement.innerHTML = '<option value="">-- Оберіть магазин --</option>';
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error("Помилка завантаження магазинів для select:", error);
    }
}

function openPurchaseModalForCreate() {
    if (!purchaseModal || !purchaseModalForm || !modalPurchaseDateInput || !modalPurchaseItemsTableBody || !modalPurchaseTotalAmountSpan) {
        console.error("Елементи модального вікна закупівлі не ініціалізовані для створення."); return;
    }
    purchaseModalTitle.textContent = 'Створити Документ Закупівлі';
    purchaseModalForm.reset();
    modalPurchaseDocIdInput.value = ''; // Для нового документа ID порожній
    currentPurchaseModalItems = []; // Очищаємо список товарів
    renderPurchaseModalItems(); // Оновлюємо таблицю товарів (має бути порожня)
    updateModalPurchaseTotalAmount(); // Оновлюємо загальну суму
    if (modalPurchaseDateInput) modalPurchaseDateInput.valueAsDate = new Date(); // Поточна дата
    populateStoreSelect(modalPurchaseStoreIdSelect); // Оновлюємо список магазинів
    purchaseModal.style.display = 'block';
}

function closePurchaseModal() {
    if(purchaseModal) purchaseModal.style.display = 'none';
}

// Функція для візуалізації товарів у таблиці модального вікна
function renderPurchaseModalItems() {
    if (!modalPurchaseItemsTableBody) return;
    modalPurchaseItemsTableBody.innerHTML = '';
    currentPurchaseModalItems.forEach((item, index) => {
        const row = modalPurchaseItemsTableBody.insertRow();
        const itemSubtotal = (parseFloat(item.quantity) * parseFloat(item.price_per_unit_purchase)).toFixed(2);
        row.innerHTML = `
            <td>${escapeHTML(item.product_name)} (ID: ${item.product_id})</td>
            <td><input type="number" value="${item.quantity}" min="0.001" step="0.001" class="modal-item-quantity" data-index="${index}"></td>
            <td><input type="number" value="${item.price_per_unit_purchase.toFixed(2)}" min="0.00" step="0.01" class="modal-item-price" data-index="${index}"></td>
            <td>${itemSubtotal}</td>
            <td><button type="button" class="delete-btn remove-modal-item-btn" data-index="${index}">X</button></td>
        `;
    });

    // Додаємо обробники для інпутів кількості/ціни та кнопок видалення
    modalPurchaseItemsTableBody.querySelectorAll('.modal-item-quantity, .modal-item-price').forEach(input => {
        input.addEventListener('change', handleModalItemChange);
    });
    modalPurchaseItemsTableBody.querySelectorAll('.remove-modal-item-btn').forEach(button => {
        button.addEventListener('click', handleRemoveModalItem);
    });
    updateModalPurchaseTotalAmount();
}

// Обробник зміни кількості або ціни товару в модалці
function handleModalItemChange(event) {
    const index = parseInt(event.target.dataset.index);
    const itemToUpdate = currentPurchaseModalItems[index];
    if (!itemToUpdate) return;

    if (event.target.classList.contains('modal-item-quantity')) {
        const newQuantity = parseFloat(event.target.value);
        if (!isNaN(newQuantity) && newQuantity > 0) {
            itemToUpdate.quantity = newQuantity;
        } else {
            event.target.value = itemToUpdate.quantity; // Повертаємо старе значення, якщо введене некоректне
            alert("Кількість має бути позитивним числом.");
        }
    } else if (event.target.classList.contains('modal-item-price')) {
        const newPrice = parseFloat(event.target.value);
        if (!isNaN(newPrice) && newPrice >= 0) {
            itemToUpdate.price_per_unit_purchase = newPrice;
        } else {
            event.target.value = itemToUpdate.price_per_unit_purchase.toFixed(2); // Повертаємо старе значення
            alert("Ціна не може бути від'ємною.");
        }
    }
    renderPurchaseModalItems(); // Перерендеримо, щоб оновити суму рядка та загальну суму
}

// Обробник видалення товару з таблиці в модалці
function handleRemoveModalItem(event) {
    const index = parseInt(event.target.dataset.index);
    currentPurchaseModalItems.splice(index, 1);
    renderPurchaseModalItems();
}


// Оновлення загальної суми в модальному вікні
function updateModalPurchaseTotalAmount() {
    if (!modalPurchaseTotalAmountSpan) return;
    const total = currentPurchaseModalItems.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) * parseFloat(item.price_per_unit_purchase));
    }, 0);
    modalPurchaseTotalAmountSpan.textContent = total.toFixed(2);
}

// Обробник натискання кнопки "Додати товар" (поки що за ID)
async function handleAddProductToModalTable() {
    if (!modalPurchaseProductIdInput || !modalPurchaseProductQtyInput || !modalPurchaseProductPriceInput) return;

    const productId = modalPurchaseProductIdInput.value.trim();
    const quantity = parseFloat(modalPurchaseProductQtyInput.value);
    const price = parseFloat(modalPurchaseProductPriceInput.value);

    if (!productId) {
        alert("Введіть ID товару.");
        return;
    }
    if (isNaN(quantity) || quantity <= 0) {
        alert("Вкажіть коректну кількість (більше 0).");
        return;
    }
    if (isNaN(price) || price < 0) {
        alert("Вкажіть коректну закупівельну ціну (0 або більше).");
        return;
    }

    // Перевіряємо, чи товар вже є у списку
    const existingItemIndex = currentPurchaseModalItems.findIndex(item => item.product_id === parseInt(productId));
    if (existingItemIndex !== -1) {
        if (confirm("Цей товар вже є в документі. Оновити кількість та ціну? (Ні - товар не буде додано/змінено)")) {
            currentPurchaseModalItems[existingItemIndex].quantity = quantity;
            currentPurchaseModalItems[existingItemIndex].price_per_unit_purchase = price;
        } else {
            return; // Не додаємо і не змінюємо
        }
    } else {
        // Отримуємо інформацію про товар (назву) за ID
        try {
            const product = await getProductByIdAPI(productId); // Використовуємо getProductByIdAPI
            if (!product) {
                alert(`Товар з ID ${productId} не знайдено.`);
                return;
            }
            currentPurchaseModalItems.push({
                product_id: product.id,
                product_name: product.name, // Додаємо назву товару
                quantity: quantity,
                price_per_unit_purchase: price
            });
        } catch (error) {
            console.error(`Помилка отримання товару ID ${productId}:`, error);
            alert(`Помилка завантаження товару з ID ${productId}: ${error.message}`);
            return;
        }
    }

    renderPurchaseModalItems(); // Оновлюємо таблицю в модалці
    // Очищаємо поля для наступного товару
    modalPurchaseProductIdInput.value = '';
    modalPurchaseProductQtyInput.value = '1';
    modalPurchaseProductPriceInput.value = '';
    modalPurchaseProductIdInput.focus();
}


async function handlePurchaseModalSubmit(event) {
    event.preventDefault();
    if (currentPurchaseModalItems.length === 0) {
        alert('Додайте хоча б один товар у документ!');
        if(apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Додайте хоча б один товар у документ!';
        return;
    }

    const purchaseData = {
        store_id: parseInt(modalPurchaseStoreIdSelect.value),
        purchase_date: modalPurchaseDateInput.value,
        document_number: modalPurchaseDocNumberInput.value || null,
        items: currentPurchaseModalItems.map(item => ({ // Беремо товари з currentPurchaseModalItems
            product_id: item.product_id,
            quantity: parseFloat(item.quantity),
            price_per_unit_purchase: parseFloat(item.price_per_unit_purchase)
        }))
    };

    if (!purchaseData.store_id || !purchaseData.purchase_date) {
        alert('Оберіть магазин та вкажіть дату документа!');
        if(apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Оберіть магазин та вкажіть дату документа!';
        return;
    }

    try {
        // const purchaseDocId = modalPurchaseDocIdInput.value; // Для майбутнього редагування
        // if (purchaseDocId) { /* логіка оновлення */ } else { /* логіка створення */ }
        
        const result = await createPurchaseAPI(purchaseData);
        if (apiResponseDiv) apiResponseDiv.textContent = `Документ закупівлі ID: ${result.purchase.id} успішно створено.`;
        closePurchaseModal();
        loadPurchases(); // Оновлюємо список документів
        loadAllPurchaseItems(); // Оновлюємо список всіх партій
    } catch (error) {
        console.error('Помилка створення документа закупівлі:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка створення документа закупівлі: ${error.message}`;
    }
}


// Функції loadPurchases, loadAllPurchaseItems, viewPurchaseDetails, setupPurchasesTableEventListeners, escapeHTML
// залишаються такими ж, як у вашому поточному файлі.
// Я їх скопіюю сюди для повноти.

export async function loadPurchases() {
    if (!purchasesTableBody) return;
    try {
        const purchases = await fetchPurchasesAPI();
        purchasesTableBody.innerHTML = '';
        purchases.forEach(doc => {
            const row = purchasesTableBody.insertRow();
            row.innerHTML = `
                <td>${doc.id}</td>
                <td>${new Date(doc.purchase_date).toLocaleDateString('uk-UA')}</td>
                <td>${escapeHTML(doc.store_name)} (ID: ${doc.store_id})</td>
                <td>${escapeHTML(doc.document_number || '')}</td>
                <td>${parseFloat(doc.total_amount).toFixed(2)}</td>
                <td>
                    <button class="view-btn" data-action="view-details" data-id="${doc.id}">Деталі</button>
                    <!-- Тут можна буде додати кнопку Редагувати, коли реалізуємо редагування -->
                </td>
            `;
        });
        if (apiResponseDiv) apiResponseDiv.textContent = 'Список документів закупівель оновлено.';
    } catch (error) {
        console.error('Помилка завантаження документів закупівель:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження документів закупівель: ${error.message}`;
    }
}

export async function loadAllPurchaseItems() {
    if (!purchaseItemsTableBody) return;
    try {
        const items = await fetchAllPurchaseItemsAPI();
        purchaseItemsTableBody.innerHTML = '';
        items.forEach(item => {
            const row = purchaseItemsTableBody.insertRow();
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.purchase_id || 'N/A'}</td>
                <td>${new Date(item.purchase_date).toLocaleDateString('uk-UA')}</td>
                <td>${item.product_id}</td>
                <td>${escapeHTML(item.product_name)}</td>
                <td>${item.store_id}</td>
                <td>${escapeHTML(item.store_name)}</td>
                <td>${item.quantity_initial}</td>
                <td>${item.quantity_remaining}</td>
                <td>${parseFloat(item.price_per_unit_purchase).toFixed(2)}</td>
            `;
        });
         if (apiResponseDiv) apiResponseDiv.textContent = 'Список всіх партій товарів оновлено.';
    } catch (error) {
        console.error('Помилка завантаження всіх партій:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження всіх партій: ${error.message}`;
    }
}

async function viewPurchaseDetails(purchaseId) {
    try {
        const purchaseDoc = await fetchPurchaseByIdAPI(purchaseId);
        let detailsHtml = `<h3>Деталі Закупівлі ID: ${purchaseDoc.id}</h3>
                           <p>Дата: ${new Date(purchaseDoc.purchase_date).toLocaleDateString('uk-UA')}</p>
                           <p>Магазин: ${escapeHTML(purchaseDoc.store_name)} (ID: ${purchaseDoc.store_id})</p>
                           <p>Номер накл.: ${escapeHTML(purchaseDoc.document_number || 'N/A')}</p>
                           <p>Загальна сума: ${parseFloat(purchaseDoc.total_amount).toFixed(2)}</p>
                           <h4>Товари:</h4><ul>`;
        purchaseDoc.items.forEach(item => {
            detailsHtml += `<li>${escapeHTML(item.product_name)} (ID: ${item.product_id}, ШК: ${escapeHTML(item.product_barcode || 'N/A')}) 
                              - К-сть: ${item.quantity_initial}, 
                              Ціна: ${parseFloat(item.price_per_unit_purchase).toFixed(2)}</li>`;
        });
        detailsHtml += `</ul>`;
        if (apiResponseDiv) apiResponseDiv.innerHTML = detailsHtml;
    } catch (error) {
        console.error('Помилка завантаження деталей закупівлі:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження деталей закупівлі: ${error.message}`;
    }
}

export function setupPurchasesTableEventListeners() {
    if (purchasesTableBody) {
        purchasesTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="view-details"]');
            if (button) {
                const purchaseId = button.dataset.id;
                viewPurchaseDetails(purchaseId);
            }
            // Тут можна буде додати обробник для кнопки "Редагувати документ"
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