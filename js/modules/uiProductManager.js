// js/modules/uiProductManager.js
import { 
    fetchProductsAPI, createProductAPI, updateProductAPI, deleteProductAPI, getProductByIdAPI,
    addProductBarcodeAPI, deleteProductBarcodeAPI,
    importProductsAPI,
    fetchProductStockByStoresAPI
} from './apiService.js';

// Змінні для елементів DOM
let productsTableBody, apiResponseDiv,
    addNewProductBtn, productModal, productModalTitle, closeProductModalBtn, cancelProductModalBtn,
    productModalForm, modalProductIdInput,
    modalProductNameField, modalProductRetailPriceField, modalProductUnitField, modalMainProductBarcodeField,
    modalAdditionalBarcodesContainer, modalAddAdditionalBarcodeBtn,
    modalTabButtons, modalTabContents, 
    productSubTabButtons, productSubTabContents, 
    exportProductsBtn, exportBarcodesBtn,
    importProductsFile, processImportProductsBtn,
    importBarcodesFile, processImportBarcodesBtn,
    productsPaginationContainer,
    productStockTableBody, noStockDataMessage;

// Змінні для стану пагінації
let currentProductPage = 1;
const productsPerPage = 30; 
let totalProductPages = 1;

export function initProductControls(responseDivElement) {
    apiResponseDiv = responseDivElement; 

    productsTableBody = document.querySelector('#productsTable tbody');
    addNewProductBtn = document.getElementById('addNewProductBtn');
    productsPaginationContainer = document.getElementById('productsPaginationContainer');
    
    productSubTabButtons = document.querySelectorAll('.product-subtabs .product-subtab-button');
    productSubTabContents = document.querySelectorAll('.product-subtab-content');

    exportProductsBtn = document.getElementById('exportProductsBtn'); 
    exportBarcodesBtn = document.getElementById('exportBarcodesBtn');
    importProductsFile = document.getElementById('importProductsFile');
    processImportProductsBtn = document.getElementById('processImportProductsBtn');
    importBarcodesFile = document.getElementById('importBarcodesFile');
    processImportBarcodesBtn = document.getElementById('processImportBarcodesBtn');

    productModal = document.getElementById('productModal');
    if (productModal) {
        productModalTitle = document.getElementById('productModalTitle');
        closeProductModalBtn = document.getElementById('closeProductModalBtn');
        cancelProductModalBtn = document.getElementById('cancelProductModalBtn');
        productModalForm = document.getElementById('productModalForm');
        modalProductIdInput = document.getElementById('modalProductId');
        modalProductNameField = document.getElementById('modalProductName');
        modalProductRetailPriceField = document.getElementById('modalProductRetailPrice');
        modalProductUnitField = document.getElementById('modalProductUnit');
        modalMainProductBarcodeField = document.getElementById('modalMainProductBarcode');
        modalAdditionalBarcodesContainer = document.getElementById('modalAdditionalBarcodesContainer');
        modalAddAdditionalBarcodeBtn = document.getElementById('modalAddAdditionalBarcodeBtn');
        modalTabButtons = document.querySelectorAll('#productModal .modal-tabs .modal-tab-button');
        modalTabContents = document.querySelectorAll('#productModal .modal-tab-content');
        
        productStockTableBody = document.getElementById('productStockTableBody');
        noStockDataMessage = document.getElementById('noStockDataMessage');

        if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
        if (cancelProductModalBtn) cancelProductModalBtn.addEventListener('click', closeProductModal);
        if (productModalForm) productModalForm.addEventListener('submit', handleProductModalSubmit);
        if (modalAddAdditionalBarcodeBtn) modalAddAdditionalBarcodeBtn.addEventListener('click', () => addAdditionalBarcodeRowToModal());
        
        productModal.addEventListener('click', (event) => {
            if (event.target === productModal) closeProductModal();
        });
        
        if (modalTabButtons && modalTabButtons.length > 0) {
            modalTabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    modalTabButtons.forEach(btn => btn.classList.remove('active'));
                    modalTabContents.forEach(content => {
                        if(content) content.classList.remove('active');
                    });
                    button.classList.add('active');
                    const targetModalTabId = button.dataset.modalTab;
                    const targetModalContent = document.getElementById(targetModalTabId);
                    if (targetModalContent) targetModalContent.classList.add('active');

                    if (targetModalTabId === 'productStockTab') {
                        const currentProductId = modalProductIdInput.value;
                        if (currentProductId) {
                            loadProductStock(currentProductId);
                        } else {
                            if (productStockTableBody) productStockTableBody.innerHTML = '';
                            if (noStockDataMessage) {
                                noStockDataMessage.textContent = 'Спочатку збережіть товар, щоб побачити залишки.';
                                noStockDataMessage.style.display = 'block';
                            }
                        }
                    }
                });
            });
        }
        if (modalAdditionalBarcodesContainer) setupModalAdditionalBarcodesContainerListeners();
    } else {
        console.warn("[uiProductManager] Модальне вікно productModal не знайдено.");
    }

    console.log('[uiProductManager] initProductControls called.');
    
    if (addNewProductBtn) addNewProductBtn.addEventListener('click', openProductModalForCreate);
        
    if (productSubTabButtons && productSubTabButtons.length > 0) {
         productSubTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                productSubTabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.product-subtab-content').forEach(content => { 
                    if(content) content.classList.remove('active');
                });

                button.classList.add('active');
                const targetSubTabId = button.dataset.productSubtab; 
                const targetSubContent = document.getElementById(targetSubTabId);
                if (targetSubContent) {
                    targetSubContent.classList.add('active');
                    if (targetSubTabId === 'productListSubTab') {
                        currentProductPage = 1; 
                        if (productsTableBody) loadProducts(currentProductPage); 
                        else console.warn("productsTableBody не знайдено при активації підвкладки productListSubTab");
                    } else if (targetSubTabId === 'productImportExportSubTab') {
                        console.log('Активовано підвкладку Імпорт/Експорт');
                    }
                } else {
                    console.warn(`Контент для підвкладки ${targetSubTabId} не знайдено.`);
                }
            });
        });
        const activeSubTabButton = document.querySelector('.product-subtabs .product-subtab-button.active');
        const productListSubTabButton = document.querySelector('.product-subtabs .product-subtab-button[data-product-subtab="productListSubTab"]');

        if (!activeSubTabButton && productListSubTabButton) {
             console.log("Симуляція кліку на підвкладку 'Список товарів' для початкової ініціалізації.");
             productListSubTabButton.click();
        } else if (activeSubTabButton && activeSubTabButton.dataset.productSubtab === 'productListSubTab') {
            if (productsTableBody) loadProducts(currentProductPage);
        }
    } else if (document.getElementById('productListSubTab') && productsTableBody) { 
        loadProducts(currentProductPage);
    }
        
    if (productsTableBody) setupProductTableEventListeners(); 
    
    if (exportProductsBtn) {
        exportProductsBtn.addEventListener('click', handleExportProducts);
    } else {
        console.warn('Кнопка exportProductsBtn не знайдена під час прив\'язки обробника в initProductControls!');
    }
    if (exportBarcodesBtn) {
        exportBarcodesBtn.addEventListener('click', handleExportBarcodes);
    }
    
    if (processImportProductsBtn && importProductsFile) {
        processImportProductsBtn.addEventListener('click', () => {
            console.log('Кнопка "processImportProductsBtn" НАТИСНУТА!');
            handleImportFile(importProductsFile, 'products');
        });
    } else {
        if (!processImportProductsBtn) console.warn('Кнопка processImportProductsBtn не знайдена при спробі прив\'язати обробник в initProductControls!');
        if (!importProductsFile) console.warn('Елемент importProductsFile не знайдений при спробі прив\'язати обробник в initProductControls!');
    }

    if (processImportBarcodesBtn && importBarcodesFile) {
        processImportBarcodesBtn.addEventListener('click', () => {
            console.log('Кнопка "processImportBarcodesBtn" НАТИСНУТА!');
            handleImportFile(importBarcodesFile, 'barcodes');
        });
    }
}

export async function loadProducts(page = 1) {
    console.log(`[uiProductManager] loadProducts викликано для сторінки: ${page}, ліміт: ${productsPerPage}`);

    productsTableBody = document.querySelector('#productsTable tbody'); // Пере-ініціалізація, якщо таблиця була видалена/додана
    productsPaginationContainer = document.getElementById('productsPaginationContainer');
    
    const loadingIndicatorRowId = 'loadingProductsRow';
    let loadingRow = document.getElementById(loadingIndicatorRowId);

    if (productsTableBody) {
        productsTableBody.innerHTML = ''; 
        if (!loadingRow) { 
            loadingRow = productsTableBody.insertRow(0); 
            loadingRow.id = loadingIndicatorRowId;
            const cell = loadingRow.insertCell();
            cell.colSpan = 6; // ID, Назва, Ціна, Од., Заг.залишок, Дії
            cell.textContent = 'Завантаження списку товарів...';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            cell.style.fontStyle = 'italic';
        } else {
            loadingRow.style.display = ''; 
        }
    }
    if (productsPaginationContainer) productsPaginationContainer.innerHTML = '';

    if (!productsTableBody) { 
        console.warn("[uiProductManager] productsTableBody не знайдено в loadProducts."); 
        return; 
    }
    if(apiResponseDiv) apiResponseDiv.textContent = `Завантаження списку товарів (сторінка ${page})...`;
    currentProductPage = page;

    try {
        const response = await fetchProductsAPI(currentProductPage, productsPerPage); 
        console.log('[uiProductManager] Відповідь від fetchProductsAPI:', JSON.stringify(response, null, 2));

        loadingRow = document.getElementById(loadingIndicatorRowId); 
        if (loadingRow) loadingRow.style.display = 'none'; 
        if (productsTableBody) productsTableBody.innerHTML = ''; 

        if (!response || typeof response !== 'object' || !response.hasOwnProperty('products') || !response.hasOwnProperty('totalPages')) {
            console.error('[uiProductManager] Некоректна структура відповіді від API або помилка запиту. Відповідь:', response);
            if (apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Некоректна відповідь від сервера при завантаженні товарів.';
            if (productsTableBody) productsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Помилка завантаження даних.</td></tr>`;
            if (productsPaginationContainer) productsPaginationContainer.innerHTML = '<p>Не вдалося завантажити дані для пагінації.</p>';
            return;
        }
        
        const products = response.products;
        totalProductPages = response.totalPages; 
        const totalProducts = response.totalProducts;

        if (!Array.isArray(products)) {
            console.error('[uiProductManager] Очікувався масив товарів, але отримано:', products);
            if (apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Отримано некоректний формат списку товарів.';
            if (productsTableBody) productsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Некоректний формат даних.</td></tr>`;
            renderProductsPagination(totalProductPages || 0, totalProducts || 0);
            return;
        }

        if (products.length === 0) {
            if (apiResponseDiv) apiResponseDiv.textContent = (page > 1) ? `На сторінці ${page} товарів немає.` : 'Список товарів порожній.';
            if (productsTableBody) productsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${(page > 1) ? 'На цій сторінці товарів немає.' : 'Список товарів порожній.'}</td></tr>`;
            renderProductsPagination(totalProductPages, totalProducts);
            return;
        }
        
        const productDetailPromises = products.map(async (baseProduct) => {
            try {
                const detailedInfo = await getProductByIdAPI(baseProduct.id);
                return { 
                    ...detailedInfo, 
                    total_stock_remaining: baseProduct.total_stock_remaining 
                };
            } catch (e) {
                console.warn(`Не вдалося завантажити деталі ШК для товару ID ${baseProduct.id}: ${e.message}`);
                return { 
                    ...baseProduct, 
                    barcodes: [] 
                };
            }
        });
        const detailedProducts = await Promise.all(productDetailPromises);

        detailedProducts.forEach(product => {
            const row = productsTableBody.insertRow();
            const retailPriceFormatted = parseFloat(product.retail_price).toFixed(2);
            // const additionalBarcodesCount - розрахунок видалено, так як колонка прихована
            
            const stockValue = parseFloat(product.total_stock_remaining);
            const totalStockDisplay = (!isNaN(stockValue) && stockValue > 0) ? stockValue.toFixed(2) : '-';

            // console.log(`Товар ID ${product.id}: total_stock_remaining = ${product.total_stock_remaining}, totalStockDisplay = ${totalStockDisplay}`);

            row.innerHTML = `
                <td>${product.id}</td>
                <td class="product-name-clickable" data-id="${product.id}" style="cursor:pointer; color:blue; text-decoration:underline;">${escapeHTML(product.name)}</td>
                <td>${retailPriceFormatted}</td>
                <td>${escapeHTML(product.unit || 'шт')}</td>
                <td>${totalStockDisplay}</td>
                <td>
                    <button class="delete-btn product-delete-action" data-action="delete" data-id="${product.id}" title="Видалити товар" style="padding: 5px 8px; font-size: 1.1em; background: transparent; border: none; color: #dc3545;">✖</button>
                </td>`;
        });

        if (apiResponseDiv) apiResponseDiv.textContent = `Список товарів оновлено (сторінка ${currentProductPage} з ${totalProductPages}). Загалом: ${totalProducts}.`;
        renderProductsPagination(totalProductPages, totalProducts);

    } catch (error) {
        const loadingRowOnError = document.getElementById(loadingIndicatorRowId);
        if (loadingRowOnError) loadingRowOnError.style.display = 'none';
        if (productsTableBody) productsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Помилка завантаження товарів.</td></tr>`;

        console.error('[uiProductManager] Помилка в loadProducts:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження товарів: ${error.message}`;
        if (productsPaginationContainer) productsPaginationContainer.innerHTML = '<p style="color:red;">Помилка завантаження пагінації через помилку даних.</p>';
    }
}

function renderProductsPagination(totalPages, totalProducts) {
    productsPaginationContainer = document.getElementById('productsPaginationContainer');
    if (!productsPaginationContainer) {
        console.warn("[uiProductManager] Контейнер пагінації #productsPaginationContainer не знайдено під час рендерингу.");
        return;
    }
    productsPaginationContainer.innerHTML = ''; 

    if (totalPages <= 0 && totalProducts === 0) {
        productsPaginationContainer.innerHTML = (totalProducts === 0 && currentProductPage === 1) ? '<p>Список товарів порожній.</p>' :'<p>Немає товарів для відображення на цій сторінці.</p>';
        return;
    }
     if (totalPages === 1 && totalProducts > 0 && totalProducts <= productsPerPage) {
         const infoSpanSolo = document.createElement('div');
         infoSpanSolo.innerHTML = `Всього товарів: ${totalProducts}`;
         productsPaginationContainer.appendChild(infoSpanSolo);
         return;
    }
    
    const infoSpan = document.createElement('div');
    infoSpan.id = 'productPageInfo';
    infoSpan.innerHTML = `Сторінка <strong>${currentProductPage}</strong> з ${totalPages} (Всього товарів: ${totalProducts})`;
    infoSpan.style.margin = "0 10px";
    infoSpan.style.marginBottom = "10px";

    const prevButton = document.createElement('button');
    prevButton.id = 'prevProductPageBtn';
    prevButton.innerHTML = '« Попередня';
    prevButton.disabled = currentProductPage === 1;
    prevButton.classList.add('button', 'secondary-btn'); 
    prevButton.addEventListener('click', () => {
        if (currentProductPage > 1) {
            loadProducts(currentProductPage - 1);
        }
    });

    const nextButton = document.createElement('button');
    nextButton.id = 'nextProductPageBtn';
    nextButton.innerHTML = 'Наступна »';
    nextButton.disabled = currentProductPage === totalPages;
    nextButton.classList.add('button', 'secondary-btn'); 
    nextButton.addEventListener('click', () => {
        if (currentProductPage < totalPages) {
            loadProducts(currentProductPage + 1);
        }
    });
    
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.style.marginBottom = "10px";
    buttonsWrapper.appendChild(prevButton);
    buttonsWrapper.appendChild(infoSpan); 
    buttonsWrapper.appendChild(nextButton);
    
    productsPaginationContainer.appendChild(buttonsWrapper);

    const pageNumbersDiv = document.createElement('div');
    pageNumbersDiv.id = 'productPageNumbers';
    pageNumbersDiv.style.marginTop = '5px';

    const maxPagesToShow = 5; 
    let startPage, endPage;
    if (totalPages <= maxPagesToShow) {
        startPage = 1; endPage = totalPages;
    } else {
        const maxPagesBeforeCurrentPage = Math.floor(maxPagesToShow / 2);
        const maxPagesAfterCurrentPage = Math.ceil(maxPagesToShow / 2) - 1;
        if (currentProductPage <= maxPagesBeforeCurrentPage) {
            startPage = 1; endPage = maxPagesToShow;
        } else if (currentProductPage + maxPagesAfterCurrentPage >= totalPages) {
            startPage = totalPages - maxPagesToShow + 1; endPage = totalPages;
        } else {
            startPage = currentProductPage - maxPagesBeforeCurrentPage; endPage = currentProductPage + maxPagesAfterCurrentPage;
        }
    }
    
    if (startPage > 1) {
        const firstPageButton = document.createElement('button');
        firstPageButton.textContent = '1';
        firstPageButton.classList.add('page-number-btn');
        firstPageButton.dataset.page = 1;
        firstPageButton.addEventListener('click', (e) => loadProducts(parseInt(e.target.dataset.page)));
        pageNumbersDiv.appendChild(firstPageButton);
        if (startPage > 2) {
            const dots = document.createElement('span'); dots.textContent = ' ... '; dots.style.margin = "0 5px";
            pageNumbersDiv.appendChild(dots);
        }
    }
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.add('page-number-btn');
        if (i === currentProductPage) {
            pageButton.classList.add('active'); pageButton.disabled = true;
        }
        pageButton.dataset.page = i;
        pageButton.addEventListener('click', (e) => loadProducts(parseInt(e.target.dataset.page)));
        pageNumbersDiv.appendChild(pageButton);
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span'); dots.textContent = ' ... '; dots.style.margin = "0 5px";
            pageNumbersDiv.appendChild(dots);
        }
        const lastPageButton = document.createElement('button');
        lastPageButton.textContent = totalPages;
        lastPageButton.classList.add('page-number-btn');
        lastPageButton.dataset.page = totalPages;
        lastPageButton.addEventListener('click', (e) => loadProducts(parseInt(e.target.dataset.page)));
        pageNumbersDiv.appendChild(lastPageButton);
    }
    productsPaginationContainer.appendChild(pageNumbersDiv);
}


async function loadProductStock(productId) {
    productStockTableBody = document.getElementById('productStockTableBody');
    noStockDataMessage = document.getElementById('noStockDataMessage');

    if (!productStockTableBody || !noStockDataMessage) {
        console.warn("[uiProductManager] Елементи для вкладки 'Залишки' (#productStockTableBody, #noStockDataMessage) не знайдені при виклику loadProductStock.");
        return;
    }
    productStockTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Завантаження залишків...</td></tr>';
    noStockDataMessage.style.display = 'none';

    try {
        const stockData = await fetchProductStockByStoresAPI(productId);
        productStockTableBody.innerHTML = ''; 

        if (!stockData || stockData.length === 0) {
            noStockDataMessage.textContent = 'Для цього товару немає даних про залишки на складах.';
            noStockDataMessage.style.display = 'block';
            return;
        }

        stockData.forEach(item => {
            const row = productStockTableBody.insertRow();
            const purchaseDate = new Date(item.purchase_date).toLocaleDateString('uk-UA');
            row.innerHTML = `
                <td>${escapeHTML(item.store_name)} (ID: ${item.store_id})</td>
                <td>${purchaseDate}</td>
                <td>${parseFloat(item.quantity_initial).toFixed(2)}</td>
                <td>${parseFloat(item.quantity_remaining).toFixed(2)}</td>
                <td>${parseFloat(item.price_per_unit_purchase).toFixed(2)}</td>
                <td>${item.purchase_item_id}</td>
            `;
        });

    } catch (error) {
        console.error(`Помилка завантаження залишків для товару ID ${productId}:`, error);
        productStockTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Помилка завантаження залишків: ${error.message}</td></tr>`;
        noStockDataMessage.style.display = 'none';
    }
}

function openProductModalForCreate() {
    if(!productModalTitle || !productModalForm || !modalProductIdInput || !modalAdditionalBarcodesContainer || !modalProductNameField || !productModal) {
        console.error("Елементи модального вікна не ініціалізовані для створення товару."); return;
    }
    productModalTitle.textContent = 'Додати Новий Товар'; 
    productModalForm.reset(); 
    modalProductIdInput.value = ''; 
    modalAdditionalBarcodesContainer.innerHTML = ''; 
    
    productStockTableBody = document.getElementById('productStockTableBody'); 
    noStockDataMessage = document.getElementById('noStockDataMessage');     
    if (productStockTableBody) productStockTableBody.innerHTML = '';
    if (noStockDataMessage) {
        noStockDataMessage.textContent = 'Залишки будуть доступні після збереження товару.';
        noStockDataMessage.style.display = 'block';
    }
    activateModalTab('productMainInfoTab');
    productModal.style.display = 'block';
    if(modalProductNameField) modalProductNameField.focus();
}

async function openProductModalForEdit(productId) {
    if(!productModalTitle || !productModalForm || !modalAdditionalBarcodesContainer || !modalProductIdInput || 
       !modalProductNameField || !modalProductRetailPriceField || !modalProductUnitField || !modalMainProductBarcodeField || !productModal) {
        console.error("Елементи модального вікна не ініціалізовані для редагування товару."); return;
    }
    productModalTitle.textContent = 'Редагувати Товар'; 
    productModalForm.reset();
    modalAdditionalBarcodesContainer.innerHTML = ''; 
    
    productStockTableBody = document.getElementById('productStockTableBody'); 
    noStockDataMessage = document.getElementById('noStockDataMessage');     
    if (productStockTableBody) productStockTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Оберіть вкладку "Залишки" для завантаження.</td></tr>';
    if (noStockDataMessage) noStockDataMessage.style.display = 'none';

    activateModalTab('productMainInfoTab');

    try {
        const product = await getProductByIdAPI(productId);
        modalProductIdInput.value = product.id; 
        modalProductNameField.value = decodeHTML(product.name);
        modalProductRetailPriceField.value = parseFloat(product.retail_price).toFixed(2);
        modalProductUnitField.value = decodeHTML(product.unit || 'шт');
        modalMainProductBarcodeField.value = decodeHTML(product.barcode || '');
        if (product.barcodes && Array.isArray(product.barcodes)) {
            product.barcodes.forEach(bc => {
                if (bc.description !== 'Основний штрихкод (з картки товару)') addAdditionalBarcodeRowToModal(bc);
            });
        }
        productModal.style.display = 'block';
    } catch (error) {
        console.error(`Помилка завантаження товару ID ${productId} для редагування:`, error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження товару: ${error.message}`;
    }
}

function closeProductModal() { if(productModal) productModal.style.display = 'none'; }

function activateModalTab(tabId) { 
    modalTabButtons = document.querySelectorAll('#productModal .modal-tabs .modal-tab-button'); 
    modalTabContents = document.querySelectorAll('#productModal .modal-tab-content'); 

    if (!modalTabButtons || !modalTabContents || modalTabButtons.length === 0 || modalTabContents.length === 0) {
        console.warn("Кнопки або контент вкладок модального вікна не знайдені для activateModalTab (можливо, модалка ще не в DOM або IDs неправильні).");
        return;
    }
    modalTabButtons.forEach(btn => btn.classList.remove('active'));
    modalTabContents.forEach(content => { if(content) content.classList.remove('active'); });
    
    const activeButton = document.querySelector(`#productModal .modal-tab-button[data-modal-tab="${tabId}"]`);
    const activeContent = document.getElementById(tabId);

    if(activeButton) activeButton.classList.add('active');
    if(activeContent) activeContent.classList.add('active');
}

function addAdditionalBarcodeRowToModal(barcode = { id: null, barcode_value: '', description: '' }) {
    if (!modalAdditionalBarcodesContainer) return;
    const barcodeIdAttr = barcode.id ? `data-barcode-id="${barcode.id}"` : '';
    const itemRow = document.createElement('div');
    itemRow.classList.add('item-row', 'additional-barcode-entry');
    itemRow.innerHTML = `<input type="text" value="${escapeHTML(barcode.barcode_value)}" placeholder="Значення штрихкоду" class="additional-barcode-value" style="flex-grow: 2;" ${barcodeIdAttr}><input type="text" value="${escapeHTML(barcode.description || '')}" placeholder="Опис (опціонально)" class="additional-barcode-description" style="flex-grow: 1;"><button type="button" class="delete-btn remove-additional-barcode-btn" style="flex-shrink: 0;">X</button>`;
    modalAdditionalBarcodesContainer.appendChild(itemRow);
}

async function handleProductModalSubmit(event) {
    event.preventDefault();
    if(!modalProductIdInput || !modalProductNameField || !modalProductRetailPriceField || !modalProductUnitField || !modalMainProductBarcodeField || !modalAdditionalBarcodesContainer) {
        console.error("handleProductModalSubmit: Елементи форми модального вікна не ініціалізовані."); return;
    }
    const id = modalProductIdInput.value;
    const productData = {
        name: modalProductNameField.value, retail_price: parseFloat(modalProductRetailPriceField.value),
        unit: modalProductUnitField.value || 'шт', barcode: modalMainProductBarcodeField.value || null, 
    };
    if (!productData.name || isNaN(productData.retail_price)) {
        alert('Назва товару та роздрібна ціна є обов\'язковими!');
        if(apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Назва товару та роздрібна ціна є обов\'язковими!'; return;
    }
    const additionalBarcodeEntries = modalAdditionalBarcodesContainer.querySelectorAll('.additional-barcode-entry');
    const barcodesArray = []; const currentBarcodesOnForm = []; 
    additionalBarcodeEntries.forEach(entry => {
        const valueInput = entry.querySelector('.additional-barcode-value');
        const descInput = entry.querySelector('.additional-barcode-description');
        const barcodeId = valueInput.dataset.barcodeId; 
        if (valueInput.value.trim() !== '') {
            const bcData = { barcode_value: valueInput.value.trim(), description: descInput.value.trim() || null };
            if (barcodeId) bcData.id = parseInt(barcodeId);
            barcodesArray.push(bcData); currentBarcodesOnForm.push(bcData);
        }
    });
    if (!id) productData.barcodesArray = barcodesArray;
    
    try {
        let resultMessage = ''; let savedProduct;
        if (id) { 
            savedProduct = await updateProductAPI(id, productData);
            resultMessage = `Товар "${savedProduct.name}" оновлено.`;
            await syncAdditionalBarcodes(id, currentBarcodesOnForm, savedProduct.barcodes || []);
        } else { 
            savedProduct = await createProductAPI(productData); 
            resultMessage = `Товар "${savedProduct.name}" створено.`;
        }
        if (apiResponseDiv) apiResponseDiv.textContent = resultMessage;
        closeProductModal();
        loadProducts(currentProductPage);
    } catch (error) {
        console.error('Помилка збереження товару:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка збереження товару: ${error.message}`;
    }
}

async function syncAdditionalBarcodes(productId, barcodesFromForm, barcodesFromDB) {
    const dbBarcodesToCompare = barcodesFromDB.filter(b => b.description !== 'Основний штрихкод (з картки товару)');
    for (const dbBarcode of dbBarcodesToCompare) {
        const foundOnForm = barcodesFromForm.find(formBc => formBc.id === dbBarcode.id);
        if (!foundOnForm) {
            try { await deleteProductBarcodeAPI(productId, dbBarcode.id); } 
            catch (e) { console.error(`Помилка видалення старого ШК ID ${dbBarcode.id}: ${e.message}`); }
        }
    }
    for (const formBarcode of barcodesFromForm) {
        if (!formBarcode.id && formBarcode.barcode_value) { 
             try { await addProductBarcodeAPI(productId, { barcode_value: formBarcode.barcode_value, description: formBarcode.description }); } 
             catch (e) { console.error(`Помилка додавання нового ШК ${formBarcode.barcode_value}: ${e.message}`); }
        }
    }
}

async function handleDeleteProductRow(id) {
    if (!confirm(`Ви дійсно хочете видалити товар ID: ${id}? Усі пов'язані штрихкоди також будуть видалені.`)) return;
    try {
        const result = await deleteProductAPI(id);
        if (apiResponseDiv) apiResponseDiv.textContent = result.message || `Товар ID: ${id} видалено.`;
        
        const currentTableRows = productsTableBody ? productsTableBody.rows.length : 0;
        if (currentTableRows === 1 && currentProductPage > 1 && totalProductPages > 1) { 
            loadProducts(currentProductPage - 1);
        } else {
            loadProducts(currentProductPage);
        }
    } catch (error) {
        console.error('Помилка видалення товару:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка видалення товару: ${error.message}`;
    }
}

export function setupProductTableEventListeners() {
    if (productsTableBody) {
        productsTableBody.addEventListener('click', (event) => {
            const target = event.target;
            
            if (target.classList.contains('product-name-clickable')) {
                const productId = target.dataset.id;
                if (productId) {
                    openProductModalForEdit(productId);
                }
            }

            const deleteButton = target.closest('.product-delete-action'); 
            if (deleteButton) {
                const action = deleteButton.dataset.action;
                const id = deleteButton.dataset.id;
                if (action === 'delete') {
                    handleDeleteProductRow(id);
                }
            }
        });
    }
}

function setupModalAdditionalBarcodesContainerListeners() {
    if (modalAdditionalBarcodesContainer) {
        modalAdditionalBarcodesContainer.addEventListener('click', function(event) {
            if (event.target.classList.contains('remove-additional-barcode-btn')) {
                const entryDiv = event.target.closest('.additional-barcode-entry');
                const barcodeValueInput = entryDiv.querySelector('.additional-barcode-value');
                const barcodeIdToRemove = barcodeValueInput ? barcodeValueInput.dataset.barcodeId : null;
                const currentProductId = modalProductIdInput.value; 
                if (barcodeIdToRemove && currentProductId) { 
                    if (confirm('Видалити цей штрихкод також із бази даних? (Якщо товар вже збережено)')) {
                         deleteProductBarcodeAPI(currentProductId, barcodeIdToRemove)
                            .then(() => {
                                if(apiResponseDiv) apiResponseDiv.textContent = `Штрихкод ID ${barcodeIdToRemove} видалено з БД.`;
                                entryDiv.remove();
                            })
                            .catch(err => {
                                if(apiResponseDiv) apiResponseDiv.textContent = `Помилка видалення ШК з БД: ${err.message}`;
                                console.error(err);
                            });
                    } else { entryDiv.remove(); }
                } else { entryDiv.remove(); }
            }
        });
    }
}

async function handleExportProducts() { 
    if(apiResponseDiv) apiResponseDiv.textContent = "Підготовка даних для експорту товарів...";
    try {
        let allProducts = [];
        let currentPageToFetch = 1;
        let totalPagesToFetch = 1;
        let fetchedProductsCount = 0;

        if(apiResponseDiv) apiResponseDiv.textContent = "Завантаження всіх товарів для експорту...";
        
        const initialPageData = await fetchProductsAPI(1, 1); 
        if (initialPageData && initialPageData.totalPages) {
            totalPagesToFetch = initialPageData.totalPages;
        } else {
            console.warn("Не вдалося визначити загальну кількість сторінок для експорту.");
            if(apiResponseDiv) apiResponseDiv.textContent = "Помилка: не вдалося визначити загальну кількість сторінок для експорту.";
            alert("Не вдалося отримати інформацію про загальну кількість сторінок. Експорт може бути неповним.");
            return;
        }

        for (currentPageToFetch = 1; currentPageToFetch <= totalPagesToFetch; currentPageToFetch++) {
            if(apiResponseDiv) apiResponseDiv.textContent = `Експорт: завантаження сторінки ${currentPageToFetch} з ${totalPagesToFetch}...`;
            const pageData = await fetchProductsAPI(currentPageToFetch, productsPerPage);
            if (pageData && pageData.products) {
                allProducts = allProducts.concat(pageData.products);
                fetchedProductsCount += pageData.products.length;
            } else {
                console.warn(`Проблеми при завантаженні сторінки ${currentPageToFetch} для експорту.`);
                break; 
            }
        }
        if(apiResponseDiv) apiResponseDiv.textContent = `Завантажено ${fetchedProductsCount} товарів. Підготовка файлу...`;

        if (allProducts.length === 0) {
            alert("Немає товарів для експорту.");
            if(apiResponseDiv) apiResponseDiv.textContent = "Немає товарів для експорту."; return;
        }
        const dataToExport = allProducts.map(p => ({
            'ID': p.id, 
            'Назва Товару': p.name, 
            'Основний ШК': p.barcode || '',
            'Роздрібна Ціна': parseFloat(p.retail_price).toFixed(2),
            'Одиниця Виміру': p.unit || 'шт',
            'Загальний Залишок': p.total_stock_remaining ? parseFloat(p.total_stock_remaining).toFixed(2) : '0.00'
        }));
        exportToExcel(dataToExport, "Список_Товарів");
        if(apiResponseDiv) apiResponseDiv.textContent = "Список товарів успішно експортовано.";
    } catch (error) {
        console.error("Помилка експорту товарів:", error);
        if(apiResponseDiv) apiResponseDiv.textContent = `Помилка експорту товарів: ${error.message}`;
        alert(`Помилка експорту товарів: ${error.message}`);
    }
}
async function handleExportBarcodes() { /* ... (ваш код, можливо, теж потребує завантаження всіх товарів/штрихкодів) ... */ }
function exportToExcel(data, fileName) { /* ... (ваш код) ... */ }
async function handleImportFile(fileInputElement, importType) { /* ... (ваш код, як був виправлений раніше) ... */ }

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

function decodeHTML(html) {
    if (html === null || html === undefined) return '';
    if (typeof html !== 'string') html = String(html);
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}