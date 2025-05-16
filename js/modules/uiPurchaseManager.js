// js/modules/uiPurchaseManager.js
import { 
    createPurchaseAPI, fetchPurchasesAPI, fetchPurchaseByIdAPI, 
    fetchAllPurchaseItemsAPI, fetchStoresAPI, 
    getProductByIdAPI, // Для отримання назви товару при додаванні за ID (якщо пошук не використовується)
    searchProductsByNameOrBarcodeAPI // Для пошуку товарів
} from './apiService.js';

let purchasesTableBody, apiResponseDiv;

// Елементи модального вікна
let addNewPurchaseDocBtn, purchaseModal, purchaseModalTitle, closePurchaseModalBtn, cancelPurchaseModalBtn,
    purchaseModalForm, modalPurchaseDocIdInput, modalPurchaseStoreIdSelect, modalPurchaseDateInput,
    modalPurchaseDocNumberInput, modalPurchaseItemsTableBody,
    modalPurchaseProductSearchInput, modalPurchaseProductSearchResults,
    modalPurchaseSelectedProductName, modalPurchaseSelectedProductId,
    modalPurchaseProductQtyInput, modalPurchaseProductPriceInput, addProductToPurchaseModalBtn,
    modalPurchaseTotalAmountSpan;

let currentPurchaseModalItems = [];
let debounceTimerPurchase; // Окремий таймер для закупівель

export function initPurchaseControls(responseDivElement) {
    apiResponseDiv = responseDivElement;
    purchasesTableBody = document.querySelector('#purchasesTable tbody');
    
    addNewPurchaseDocBtn = document.getElementById('addNewPurchaseDocBtn');
    purchaseModal = document.getElementById('purchaseModal');

    if (purchaseModal) { 
        purchaseModalTitle = document.getElementById('purchaseModalTitle');
        closePurchaseModalBtn = document.getElementById('closePurchaseModalBtn');
        cancelPurchaseModalBtn = document.getElementById('cancelPurchaseModalBtn');
        purchaseModalForm = document.getElementById('purchaseModalForm');
        modalPurchaseDocIdInput = document.getElementById('modalPurchaseDocId');
        modalPurchaseStoreIdSelect = document.getElementById('modalPurchaseStoreId');
        modalPurchaseDateInput = document.getElementById('modalPurchaseDate');
        modalPurchaseDocNumberInput = document.getElementById('modalPurchaseDocNumber');
        modalPurchaseItemsTableBody = document.getElementById('modalPurchaseItemsTableBody');
        
        modalPurchaseProductSearchInput = document.getElementById('modalPurchaseProductSearchInput');
        modalPurchaseProductSearchResults = document.getElementById('modalPurchaseProductSearchResults');
        modalPurchaseSelectedProductName = document.getElementById('modalPurchaseSelectedProductName');
        modalPurchaseSelectedProductId = document.getElementById('modalPurchaseSelectedProductId');
        
        modalPurchaseProductQtyInput = document.getElementById('modalPurchaseProductQtyInput');
        modalPurchaseProductPriceInput = document.getElementById('modalPurchaseProductPriceInput');
        addProductToPurchaseModalBtn = document.getElementById('addProductToPurchaseModalBtn');
        modalPurchaseTotalAmountSpan = document.getElementById('modalPurchaseTotalAmount');

        if (addNewPurchaseDocBtn) {
            addNewPurchaseDocBtn.addEventListener('click', openPurchaseModalForCreate);
        } else {
            console.warn("Кнопка addNewPurchaseDocBtn не знайдена.");
        }

        if (closePurchaseModalBtn) closePurchaseModalBtn.addEventListener('click', closePurchaseModal);
        if (cancelPurchaseModalBtn) cancelPurchaseModalBtn.addEventListener('click', closePurchaseModal);
        
        if (purchaseModalForm) {
            purchaseModalForm.addEventListener('submit', handlePurchaseModalSubmit);
            console.log("Обробник SUBMIT для purchaseModalForm ПРИВ'ЯЗАНО.");
        } else {
            console.warn("Форма purchaseModalForm не знайдена під час ініціалізації!");
        }
        
        if (modalPurchaseProductSearchInput) {
            modalPurchaseProductSearchInput.addEventListener('input', handlePurchaseProductSearchInput);
            modalPurchaseProductSearchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (modalPurchaseProductSearchResults) modalPurchaseProductSearchResults.style.display = 'none';
                }, 200);
            });
             modalPurchaseProductSearchInput.addEventListener('focus', () => {
                if (modalPurchaseProductSearchInput.value.trim() !== '' && modalPurchaseProductSearchResults && modalPurchaseProductSearchResults.children.length > 0) {
                     modalPurchaseProductSearchResults.style.display = 'block';
                }
            });
        }
        if (modalPurchaseProductSearchResults) {
            // Делегування події для кліку по результатах пошуку
            modalPurchaseProductSearchResults.addEventListener('mousedown', handlePurchaseProductResultSelect); // mousedown спрацьовує до blur
        }
        
        if (addProductToPurchaseModalBtn) {
            addProductToPurchaseModalBtn.addEventListener('click', handleAddProductToModalTableFromSelection);
        }

        purchaseModal.addEventListener('click', (event) => {
            if (event.target === purchaseModal) closePurchaseModal();
        });
        
        populateStoreSelect(modalPurchaseStoreIdSelect); 
    } else {
        console.warn("Модальне вікно purchaseModal не знайдено.");
    }
    
    setupPurchasesTableEventListeners();
    console.log("[uiPurchaseManager] initPurchaseControls завершено.");
}

async function populateStoreSelect(selectElement) {
    if (!selectElement) {
        console.warn("populateStoreSelect: selectElement не передано або не знайдено.");
        return;
    }
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

function setPurchaseFormReadOnly(isReadOnly) {
    if (modalPurchaseStoreIdSelect) modalPurchaseStoreIdSelect.disabled = isReadOnly;
    if (modalPurchaseDateInput) modalPurchaseDateInput.readOnly = isReadOnly;
    if (modalPurchaseDocNumberInput) modalPurchaseDocNumberInput.readOnly = isReadOnly;

    const addProductSection = modalPurchaseProductSearchInput?.closest('div[style*="border: 1px solid #eee"]'); // Знаходимо батьківський блок секції додавання
    if (addProductSection) addProductSection.style.display = isReadOnly ? 'none' : 'block'; // 'block' або початковий стиль
    
    const submitButton = purchaseModalForm?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.style.display = isReadOnly ? 'none' : 'inline-block';

    if (modalPurchaseItemsTableBody) {
        modalPurchaseItemsTableBody.querySelectorAll('input').forEach(input => {
            input.readOnly = isReadOnly;
        });
        modalPurchaseItemsTableBody.querySelectorAll('.remove-modal-item-btn').forEach(button => {
            button.style.display = isReadOnly ? 'none' : 'inline-block';
        });
    }
}

async function openPurchaseModalForView(purchaseId) {
    if (!purchaseModal || !purchaseModalForm) {
        console.error("Елементи модального вікна закупівлі не ініціалізовані для перегляду."); return;
    }
    
    try {
        if (apiResponseDiv) apiResponseDiv.textContent = `Завантаження деталей закупівлі ID: ${purchaseId}...`;
        const purchaseDoc = await fetchPurchaseByIdAPI(purchaseId);
        if (!purchaseDoc) {
            if (apiResponseDiv) apiResponseDiv.textContent = `Не вдалося завантажити документ закупівлі ID: ${purchaseId}.`;
            alert(`Не вдалося завантажити документ закупівлі ID: ${purchaseId}.`);
            return;
        }

        if (purchaseModalTitle) purchaseModalTitle.textContent = `Деталі Документа Закупівлі ID: ${purchaseDoc.id}`;
        purchaseModalForm.reset(); 
        if (modalPurchaseDocIdInput) modalPurchaseDocIdInput.value = purchaseDoc.id;

        if (modalPurchaseStoreIdSelect) await populateStoreSelect(modalPurchaseStoreIdSelect); 
        if (modalPurchaseStoreIdSelect) modalPurchaseStoreIdSelect.value = purchaseDoc.store_id;
        if (modalPurchaseDateInput) modalPurchaseDateInput.value = purchaseDoc.purchase_date.split('T')[0]; 
        if (modalPurchaseDocNumberInput) modalPurchaseDocNumberInput.value = purchaseDoc.document_number || '';

        currentPurchaseModalItems = purchaseDoc.items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: parseFloat(item.quantity_initial),
            price_per_unit_purchase: parseFloat(item.price_per_unit_purchase)
        }));
        
        setPurchaseFormReadOnly(true); 
        renderPurchaseModalItems(); 
        
        purchaseModal.style.display = 'block';
        if (apiResponseDiv) apiResponseDiv.textContent = `Відображено деталі закупівлі ID: ${purchaseDoc.id}.`;

    } catch (error) {
        console.error(`Помилка відкриття деталей закупівлі ID ${purchaseId}:`, error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка: ${error.message}`;
        alert(`Помилка завантаження деталей: ${error.message}`);
    }
}

function openPurchaseModalForCreate() {
    if (!purchaseModal || !purchaseModalForm) {
        console.error("Елементи модального вікна закупівлі не ініціалізовані для створення."); return;
    }
    if (purchaseModalTitle) purchaseModalTitle.textContent = 'Створити Документ Закупівлі';
    purchaseModalForm.reset();
    if (modalPurchaseDocIdInput) modalPurchaseDocIdInput.value = ''; 
    currentPurchaseModalItems = []; 
    
    setPurchaseFormReadOnly(false); 
    renderPurchaseModalItems(); 
    
    if (modalPurchaseDateInput) modalPurchaseDateInput.valueAsDate = new Date();
    if (modalPurchaseStoreIdSelect) populateStoreSelect(modalPurchaseStoreIdSelect); 
    purchaseModal.style.display = 'block';
    if (apiResponseDiv) apiResponseDiv.textContent = "Форма для створення нового документа закупівлі готова.";
    if (modalPurchaseProductSearchInput) modalPurchaseProductSearchInput.focus();
}

function closePurchaseModal() {
    if(purchaseModal) purchaseModal.style.display = 'none';
    currentPurchaseModalItems = []; // Очищаємо товари при закритті
    if (modalPurchaseProductSearchInput) modalPurchaseProductSearchInput.value = ''; // Очищаємо поле пошуку
    if (modalPurchaseSelectedProductName) modalPurchaseSelectedProductName.value = 'Не обрано';
    if (modalPurchaseSelectedProductId) modalPurchaseSelectedProductId.value = '';
    if (apiResponseDiv) apiResponseDiv.textContent = "Модальне вікно закупівлі закрито.";
}

function renderPurchaseModalItems() {
    if (!modalPurchaseItemsTableBody) return;
    const isReadOnly = modalPurchaseDateInput?.readOnly || false; 

    modalPurchaseItemsTableBody.innerHTML = '';
    currentPurchaseModalItems.forEach((item, index) => {
        const row = modalPurchaseItemsTableBody.insertRow();
        const itemSubtotal = (parseFloat(item.quantity) * parseFloat(item.price_per_unit_purchase)).toFixed(2);
        row.innerHTML = `
            <td>${escapeHTML(item.product_name)} (ID: ${item.product_id})</td>
            <td><input type="number" value="${item.quantity}" min="0.001" step="0.001" class="modal-item-quantity" data-index="${index}" ${isReadOnly ? 'readonly' : ''}></td>
            <td><input type="number" value="${parseFloat(item.price_per_unit_purchase).toFixed(2)}" min="0.00" step="0.01" class="modal-item-price" data-index="${index}" ${isReadOnly ? 'readonly' : ''}></td>
            <td>${itemSubtotal}</td>
            <td><button type="button" class="delete-btn remove-modal-item-btn" data-index="${index}" style="display: ${isReadOnly ? 'none' : 'inline-block'};">X</button></td>
        `;
    });

    if (!isReadOnly) { 
        modalPurchaseItemsTableBody.querySelectorAll('.modal-item-quantity, .modal-item-price').forEach(input => {
            input.removeEventListener('change', handleModalItemChange); // Видаляємо старі, щоб уникнути дублів
            input.addEventListener('change', handleModalItemChange);
        });
        modalPurchaseItemsTableBody.querySelectorAll('.remove-modal-item-btn').forEach(button => {
            button.removeEventListener('click', handleRemoveModalItem); // Видаляємо старі
            button.addEventListener('click', handleRemoveModalItem);
        });
    }
    updateModalPurchaseTotalAmount();
}

function handleModalItemChange(event) {
    const index = parseInt(event.target.dataset.index);
    if (index < 0 || index >= currentPurchaseModalItems.length) return; // Захист від неіснуючого індексу
    const itemToUpdate = currentPurchaseModalItems[index];
    
    if (event.target.classList.contains('modal-item-quantity')) {
        const newQuantity = parseFloat(event.target.value);
        if (!isNaN(newQuantity) && newQuantity > 0) itemToUpdate.quantity = newQuantity;
        else { event.target.value = itemToUpdate.quantity; alert("Кількість має бути позитивним числом."); }
    } else if (event.target.classList.contains('modal-item-price')) {
        const newPrice = parseFloat(event.target.value);
        if (!isNaN(newPrice) && newPrice >= 0) itemToUpdate.price_per_unit_purchase = newPrice;
        else { event.target.value = itemToUpdate.price_per_unit_purchase.toFixed(2); alert("Ціна не може бути від'ємною."); }
    }
    renderPurchaseModalItems(); 
}

function handleRemoveModalItem(event) {
    const index = parseInt(event.target.dataset.index);
    if (index >= 0 && index < currentPurchaseModalItems.length) { // Захист
        currentPurchaseModalItems.splice(index, 1);
        renderPurchaseModalItems();
    }
}

function updateModalPurchaseTotalAmount() {
    if (!modalPurchaseTotalAmountSpan) return;
    const total = currentPurchaseModalItems.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) * parseFloat(item.price_per_unit_purchase));
    }, 0);
    modalPurchaseTotalAmountSpan.textContent = total.toFixed(2);
}

async function handlePurchaseProductSearchInput(event) {
    const searchTerm = event.target.value.trim();
    if (!modalPurchaseProductSearchResults || !modalPurchaseSelectedProductId || !modalPurchaseSelectedProductName) return;

    modalPurchaseSelectedProductId.value = ''; 
    modalPurchaseSelectedProductName.value = 'Пошук...';

    if (searchTerm.length < 2) { 
        modalPurchaseProductSearchResults.innerHTML = '';
        modalPurchaseProductSearchResults.style.display = 'none';
        if (searchTerm.length === 0) modalPurchaseSelectedProductName.value = 'Не обрано';
        return;
    }

    modalPurchaseProductSearchResults.style.display = 'block';
    modalPurchaseProductSearchResults.innerHTML = '<li>Завантаження...</li>';

    clearTimeout(debounceTimerPurchase);
    debounceTimerPurchase = setTimeout(async () => {
        try {
            const results = await searchProductsByNameOrBarcodeAPI(searchTerm, 7);
            displayPurchaseProductSearchResults(results);
        } catch (error) {
            console.error("Помилка пошуку товару для закупівлі:", error);
            if (modalPurchaseProductSearchResults) modalPurchaseProductSearchResults.innerHTML = `<li style="color:red;">Помилка пошуку: ${error.message}</li>`;
        }
    }, 300); 
}

function displayPurchaseProductSearchResults(products) {
    if (!modalPurchaseProductSearchResults) return;
    modalPurchaseProductSearchResults.innerHTML = '';
    if (!products || products.length === 0) {
        modalPurchaseProductSearchResults.innerHTML = '<li>Товарів не знайдено</li>';
        modalPurchaseProductSearchResults.style.display = 'block';
        return;
    }

    products.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `${product.name} (ID: ${product.id}, ШК: ${product.barcode || '-'}, Ціна: ${product.retail_price})`;
        li.dataset.productId = product.id;
        li.dataset.productName = product.name;
        // Можна передати і закупівельну ціну з картки товару, якщо вона там є і актуальна
        li.dataset.purchasePrice = product.purchase_price || '0'; 
        li.style.padding = '8px';
        li.style.cursor = 'pointer';
        li.addEventListener('mouseenter', () => li.style.backgroundColor = '#f0f0f0');
        li.addEventListener('mouseleave', () => li.style.backgroundColor = 'white');
        // Обробник кліку тепер через делегування на батьківському елементі (mousedown)
        modalPurchaseProductSearchResults.appendChild(li);
    });
    modalPurchaseProductSearchResults.style.display = 'block';
}

function handlePurchaseProductResultSelect(event) {
    // Використовуємо event.target.closest('li') для надійності, якщо всередині li є інші елементи
    const listItem = event.target.closest('li');
    if (listItem && listItem.dataset.productId) {
        const productId = listItem.dataset.productId;
        const productName = listItem.dataset.productName;
        const purchasePrice = listItem.dataset.purchasePrice;

        if (modalPurchaseProductSearchInput) modalPurchaseProductSearchInput.value = ''; // Очищаємо поле пошуку
        if (modalPurchaseSelectedProductName) modalPurchaseSelectedProductName.value = productName;
        if (modalPurchaseSelectedProductId) modalPurchaseSelectedProductId.value = productId;
        if (modalPurchaseProductPriceInput && purchasePrice) { // Підставляємо закупівельну ціну, якщо є
            modalPurchaseProductPriceInput.value = parseFloat(purchasePrice).toFixed(2);
        } else if (modalPurchaseProductPriceInput) {
            modalPurchaseProductPriceInput.value = ''; // Очищаємо, якщо немає
        }
        
        if (modalPurchaseProductSearchResults) modalPurchaseProductSearchResults.style.display = 'none';
        if (modalPurchaseProductQtyInput) modalPurchaseProductQtyInput.focus(); 
    }
}

async function handleAddProductToModalTableFromSelection() {
    if (!modalPurchaseSelectedProductId || !modalPurchaseSelectedProductName || 
        !modalPurchaseProductQtyInput || !modalPurchaseProductPriceInput) return;

    const productId = modalPurchaseSelectedProductId.value;
    const productName = modalPurchaseSelectedProductName.value;
    const quantity = parseFloat(modalPurchaseProductQtyInput.value);
    const price = parseFloat(modalPurchaseProductPriceInput.value);

    if (!productId || productName === 'Не обрано' || productName === 'Пошук...') {
        alert("Спочатку оберіть товар зі списку результатів пошуку.");
        if (modalPurchaseProductSearchInput) modalPurchaseProductSearchInput.focus();
        return;
    }
    if (isNaN(quantity) || quantity <= 0) {
        alert("Вкажіть коректну кількість (більше 0).");
        if (modalPurchaseProductQtyInput) modalPurchaseProductQtyInput.focus();
        return;
    }
    if (isNaN(price) || price < 0) {
        alert("Вкажіть коректну закупівельну ціну (0 або більше).");
        if (modalPurchaseProductPriceInput) modalPurchaseProductPriceInput.focus();
        return;
    }

    const existingItemIndex = currentPurchaseModalItems.findIndex(item => item.product_id === parseInt(productId));
    if (existingItemIndex !== -1) {
        if (confirm("Цей товар вже є в документі. Оновити кількість та ціну для існуючого запису?")) {
            currentPurchaseModalItems[existingItemIndex].quantity = quantity;
            currentPurchaseModalItems[existingItemIndex].price_per_unit_purchase = price;
        } else { return; }
    } else {
        currentPurchaseModalItems.push({
            product_id: parseInt(productId),
            product_name: productName,
            quantity: quantity,
            price_per_unit_purchase: price
        });
    }
    renderPurchaseModalItems();
    if (modalPurchaseProductSearchInput) modalPurchaseProductSearchInput.value = '';
    if (modalPurchaseSelectedProductName) modalPurchaseSelectedProductName.value = 'Не обрано';
    if (modalPurchaseSelectedProductId) modalPurchaseSelectedProductId.value = '';
    if (modalPurchaseProductQtyInput) modalPurchaseProductQtyInput.value = '1';
    if (modalPurchaseProductPriceInput) modalPurchaseProductPriceInput.value = '';
    if (modalPurchaseProductSearchInput) modalPurchaseProductSearchInput.focus();
}

async function handlePurchaseModalSubmit(event) {
    console.log("handlePurchaseModalSubmit викликано!"); // Перевірка
    event.preventDefault();
    
    const purchaseDocId = modalPurchaseDocIdInput ? modalPurchaseDocIdInput.value : null;
    if (purchaseDocId) { // Якщо це режим перегляду/редагування (редагування ще не реалізовано)
        alert("Збереження змін для існуючого документа ще не реалізовано. Форма відкрита в режимі перегляду або для створення нового.");
        console.warn("Спроба зберегти документ з існуючим ID. Функціонал редагування не активний.");
        return;
    }
    
    if (currentPurchaseModalItems.length === 0) {
        alert('Додайте хоча б один товар у документ!');
        if(apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Додайте хоча б один товар у документ!';
        return;
    }

    const storeIdVal = modalPurchaseStoreIdSelect ? modalPurchaseStoreIdSelect.value : null;
    const purchaseDateVal = modalPurchaseDateInput ? modalPurchaseDateInput.value : null;

    if (!storeIdVal || !purchaseDateVal) {
        alert('Оберіть магазин та вкажіть дату документа!');
        if(apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Оберіть магазин та вкажіть дату документа!';
        return;
    }

    const purchaseData = {
        store_id: parseInt(storeIdVal),
        purchase_date: purchaseDateVal,
        document_number: modalPurchaseDocNumberInput ? modalPurchaseDocNumberInput.value || null : null,
        items: currentPurchaseModalItems.map(item => ({
            product_id: item.product_id,
            quantity: parseFloat(item.quantity),
            price_per_unit_purchase: parseFloat(item.price_per_unit_purchase)
        }))
    };

    try {
        console.log("Дані для створення закупівлі:", JSON.stringify(purchaseData, null, 2));
        if(apiResponseDiv) apiResponseDiv.textContent = 'Збереження документа закупівлі...';
        const result = await createPurchaseAPI(purchaseData);
        if (apiResponseDiv) apiResponseDiv.textContent = `Документ закупівлі ID: ${result.purchase.id} успішно створено.`;
        alert(`Документ закупівлі ID: ${result.purchase.id} успішно створено.`);
        closePurchaseModal();
        loadPurchases(); 
        loadAllPurchaseItems('purchaseItemsTableStockPageBody'); // Оновлюємо список партій на вкладці "Склад"
    } catch (error) {
        console.error('Помилка створення документа закупівлі:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка створення документа закупівлі: ${error.message || error}`;
        alert(`Помилка створення документа закупівлі: ${error.message || error}`);
    }
}

export async function loadPurchases() {
    if (!purchasesTableBody) {
        console.warn("purchasesTableBody не знайдено для loadPurchases");
        return;
    }
    if(apiResponseDiv) apiResponseDiv.textContent = 'Завантаження списку документів закупівлі...';
    try {
        const purchases = await fetchPurchasesAPI();
        purchasesTableBody.innerHTML = '';
        if (!purchases || purchases.length === 0) {
            if(apiResponseDiv) apiResponseDiv.textContent = 'Список документів закупівлі порожній.';
            purchasesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Список документів закупівлі порожній.</td></tr>`;
            return;
        }
        purchases.forEach(doc => {
            const row = purchasesTableBody.insertRow();
            row.innerHTML = `
                <td>${doc.id}</td>
                <td>${new Date(doc.purchase_date).toLocaleDateString('uk-UA')}</td>
                <td>${escapeHTML(doc.store_name)} (ID: ${doc.store_id})</td>
                <td>${escapeHTML(doc.document_number || '')}</td>
                <td>${parseFloat(doc.total_amount).toFixed(2)}</td>
                <td>
                    <button class="view-btn" data-action="view-purchase-details" data-id="${doc.id}">Деталі</button>
                </td>
            `;
        });
        if (apiResponseDiv) apiResponseDiv.textContent = 'Список документів закупівель оновлено.';
    } catch (error) {
        console.error('Помилка завантаження документів закупівель:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження документів закупівель: ${error.message}`;
        if (purchasesTableBody) purchasesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Помилка завантаження даних.</td></tr>`;
    }
}

export async function loadAllPurchaseItems(targetTableBodyId = 'purchaseItemsTableStockPageBody') {
    const currentTableBody = document.getElementById(targetTableBodyId);
    if (!currentTableBody) {
        console.warn(`Тіло таблиці з ID "${targetTableBodyId}" не знайдено для loadAllPurchaseItems.`);
        return;
    }
    if(apiResponseDiv && document.querySelector('#stock.active')) apiResponseDiv.textContent = 'Завантаження всіх партій товарів...'; // Показуємо тільки якщо вкладка Склад активна
    
    currentTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; font-style:italic;">Завантаження партій...</td></tr>`;
    try {
        const items = await fetchAllPurchaseItemsAPI();
        currentTableBody.innerHTML = ''; 
        if (!items || items.length === 0) {
            if(apiResponseDiv && document.querySelector('#stock.active')) apiResponseDiv.textContent = 'Список партій товарів порожній.';
            currentTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Список партій товарів порожній.</td></tr>`;
            return;
        }
        items.forEach(item => {
            const row = currentTableBody.insertRow();
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.purchase_id || 'N/A'}</td>
                <td>${new Date(item.purchase_date).toLocaleDateString('uk-UA')}</td>
                <td>${item.product_id}</td>
                <td>${escapeHTML(item.product_name)}</td>
                <td>${item.store_id}</td>
                <td>${escapeHTML(item.store_name)}</td>
                <td>${parseFloat(item.quantity_initial).toFixed(2)}</td>
                <td>${parseFloat(item.quantity_remaining).toFixed(2)}</td>
                <td>${parseFloat(item.price_per_unit_purchase).toFixed(2)}</td>
            `;
        });
         if (apiResponseDiv && document.querySelector('#stock.active')) apiResponseDiv.textContent = 'Список всіх партій товарів оновлено.';
    } catch (error) {
        console.error('Помилка завантаження всіх партій:', error);
        if (apiResponseDiv && document.querySelector('#stock.active')) apiResponseDiv.textContent = `Помилка завантаження всіх партій: ${error.message}`;
        if (currentTableBody) currentTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">Помилка завантаження даних.</td></tr>`;
    }
}

export function setupPurchasesTableEventListeners() {
    if (purchasesTableBody) {
        purchasesTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;
            const action = button.dataset.action;
            const purchaseId = button.dataset.id;
            if (action === "view-purchase-details") {
                openPurchaseModalForView(purchaseId); 
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