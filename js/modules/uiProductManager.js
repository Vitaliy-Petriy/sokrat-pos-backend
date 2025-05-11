// js/modules/uiProductManager.js
import { 
    fetchProductsAPI, createProductAPI, updateProductAPI, deleteProductAPI, getProductByIdAPI,
    addProductBarcodeAPI, deleteProductBarcodeAPI,
    importProductsAPI // Імпорт для функції імпорту товарів
    // importBarcodesAPI // Для майбутнього імпорту штрихкодів
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
    importBarcodesFile, processImportBarcodesBtn;

export function initProductControls(responseDivElement) {
    apiResponseDiv = responseDivElement; 

    productsTableBody = document.querySelector('#productsTable tbody');
    addNewProductBtn = document.getElementById('addNewProductBtn');
    productModal = document.getElementById('productModal');
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

    productSubTabButtons = document.querySelectorAll('#products .product-subtabs .product-subtab-button');
    productSubTabContents = document.querySelectorAll('#products .product-subtab-content');
    exportProductsBtn = document.getElementById('exportProductsBtn'); 
    exportBarcodesBtn = document.getElementById('exportBarcodesBtn');
    importProductsFile = document.getElementById('importProductsFile');
    processImportProductsBtn = document.getElementById('processImportProductsBtn');
    importBarcodesFile = document.getElementById('importBarcodesFile');
    processImportBarcodesBtn = document.getElementById('processImportBarcodesBtn');

    console.log('[uiProductManager] initProductControls called.');
    
    if (addNewProductBtn) addNewProductBtn.addEventListener('click', openProductModalForCreate);
    if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
    if (cancelProductModalBtn) cancelProductModalBtn.addEventListener('click', closeProductModal);
    if (productModalForm) productModalForm.addEventListener('submit', handleProductModalSubmit);
    if (modalAddAdditionalBarcodeBtn) modalAddAdditionalBarcodeBtn.addEventListener('click', () => addAdditionalBarcodeRowToModal());
    
    if (productModal) {
        productModal.addEventListener('click', (event) => {
            if (event.target === productModal) closeProductModal();
        });
    }
    
    if (exportProductsBtn) exportProductsBtn.addEventListener('click', handleExportProducts);
    if (exportBarcodesBtn) exportBarcodesBtn.addEventListener('click', handleExportBarcodes);

    if (processImportProductsBtn && importProductsFile) {
        processImportProductsBtn.addEventListener('click', () => handleImportFile(importProductsFile, 'products'));
    }
    if (processImportBarcodesBtn && importBarcodesFile) {
        processImportBarcodesBtn.addEventListener('click', () => handleImportFile(importBarcodesFile, 'barcodes'));
    }
        
    if (productSubTabButtons && productSubTabContents) {
        productSubTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                productSubTabButtons.forEach(btn => btn.classList.remove('active'));
                productSubTabContents.forEach(content => content.classList.remove('active'));

                button.classList.add('active');
                const targetSubTabId = button.dataset.productSubtab;
                const targetSubContent = document.getElementById(targetSubTabId);
                if (targetSubContent) {
                    targetSubContent.classList.add('active');
                    if (targetSubTabId === 'productListSubTab') {
                        if (productsTableBody) loadProducts(); 
                    }
                }
            });
        });
    }
    
    if (modalTabButtons && modalTabContents) {
        modalTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                modalTabButtons.forEach(btn => btn.classList.remove('active'));
                modalTabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                const targetModalTabId = button.dataset.modalTab;
                const targetModalContent = document.getElementById(targetModalTabId);
                if (targetModalContent) targetModalContent.classList.add('active');
            });
        });
    }
        
    if (productsTableBody) setupProductTableEventListeners(); 
    if (modalAdditionalBarcodesContainer) setupModalAdditionalBarcodesContainerListeners(); 
}

function openProductModalForCreate() {
    if(!productModalTitle || !productModalForm || !modalProductIdInput || !modalAdditionalBarcodesContainer || !modalProductNameField || !productModal) {
        console.error("Елементи модального вікна не ініціалізовані для створення товару."); return;
    }
    productModalTitle.textContent = 'Додати Новий Товар'; productModalForm.reset(); 
    modalProductIdInput.value = ''; modalAdditionalBarcodesContainer.innerHTML = ''; 
    activateModalTab('productMainInfoTab'); productModal.style.display = 'block';
    if(modalProductNameField) modalProductNameField.focus();
}

async function openProductModalForEdit(productId) {
    if(!productModalTitle || !productModalForm || !modalAdditionalBarcodesContainer || !modalProductIdInput || 
       !modalProductNameField || !modalProductRetailPriceField || !modalProductUnitField || !modalMainProductBarcodeField || !productModal) {
        console.error("Елементи модального вікна не ініціалізовані для редагування товару."); return;
    }
    productModalTitle.textContent = 'Редагувати Товар'; productModalForm.reset();
    modalAdditionalBarcodesContainer.innerHTML = ''; activateModalTab('productMainInfoTab'); 
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
    if (!modalTabButtons || !modalTabContents) return;
    modalTabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.modalTab === tabId));
    modalTabContents.forEach(content => { if(content) content.classList.toggle('active', content.id === tabId); });
}

export async function loadProducts() {
    if (!productsTableBody) { console.warn("[uiProductManager] productsTableBody не знайдено в loadProducts."); return; }
    if(apiResponseDiv) apiResponseDiv.textContent = "Завантаження списку товарів...";
    try {
        const products = await fetchProductsAPI(); 
        productsTableBody.innerHTML = '';
        if (!products || products.length === 0) { if (apiResponseDiv) apiResponseDiv.textContent = 'Список товарів порожній.'; return; }
        const productDetailPromises = products.map(product => getProductByIdAPI(product.id).catch(e => {
            console.warn(`Не вдалося завантажити деталі ШК для товару ID ${product.id}: ${e.message}`);
            return { ...product, barcodes: [] }; 
        }));
        const detailedProducts = await Promise.all(productDetailPromises);
        detailedProducts.forEach(product => {
            const row = productsTableBody.insertRow();
            const retailPriceFormatted = parseFloat(product.retail_price).toFixed(2);
            const additionalBarcodesCount = product.barcodes ? product.barcodes.filter(b => b.description !== 'Основний штрихкод (з картки товару)').length : 0;
            row.innerHTML = `<td>${product.id}</td><td>${escapeHTML(product.name)}</td><td>${escapeHTML(product.barcode || '')}</td><td>${retailPriceFormatted}</td><td>${escapeHTML(product.unit || 'шт')}</td><td>${additionalBarcodesCount}</td><td><button class="edit-btn" data-action="edit" data-id="${product.id}">Ред.</button><button class="delete-btn" data-action="delete" data-id="${product.id}">Вид.</button></td>`;
        });
        if (apiResponseDiv) apiResponseDiv.textContent = 'Список товарів оновлено.';
    } catch (error) {
        console.error('Помилка завантаження товарів:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження товарів: ${error.message}`;
    }
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
        closeProductModal(); loadProducts();
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
        loadProducts();
    } catch (error) {
        console.error('Помилка видалення товару:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка видалення товару: ${error.message}`;
    }
}

export function setupProductTableEventListeners() {
    if (productsTableBody) {
        productsTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;
            const action = button.dataset.action; const id = button.dataset.id;
            if (action === 'edit') openProductModalForEdit(id);
            else if (action === 'delete') handleDeleteProductRow(id);
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
        const products = await fetchProductsAPI(); 
        if (!products || products.length === 0) {
            alert("Немає товарів для експорту.");
            if(apiResponseDiv) apiResponseDiv.textContent = "Немає товарів для експорту."; return;
        }
        const dataToExport = products.map(p => ({
            'ID': p.id, 'Назва Товару': p.name, 'Основний ШК': p.barcode || '',
            'Роздрібна Ціна': parseFloat(p.retail_price).toFixed(2),
            'Одиниця Виміру': p.unit || 'шт',
            'Дата Створення': p.created_at ? new Date(p.created_at).toLocaleString('uk-UA') : '',
            'Дата Оновлення': p.updated_at ? new Date(p.updated_at).toLocaleString('uk-UA') : ''
        }));
        exportToExcel(dataToExport, "Список_Товарів");
        if(apiResponseDiv) apiResponseDiv.textContent = "Список товарів успішно експортовано.";
    } catch (error) {
        console.error("Помилка експорту товарів:", error);
        if(apiResponseDiv) apiResponseDiv.textContent = `Помилка експорту товарів: ${error.message}`;
        alert(`Помилка експорту товарів: ${error.message}`);
    }
}

async function handleExportBarcodes() {
    if(apiResponseDiv) apiResponseDiv.textContent = "Підготовка даних для експорту штрихкодів...";
    try {
        const products = await fetchProductsAPI();
        if (!products || products.length === 0) {
            alert("Немає товарів, для яких можна було б експортувати штрихкоди.");
            if(apiResponseDiv) apiResponseDiv.textContent = "Немає товарів для експорту штрихкодів."; return;
        }
        let allBarcodesData = [];
        const productDetailPromises = products.map(p => getProductByIdAPI(p.id));
        const detailedProducts = await Promise.all(productDetailPromises.map(p => p.catch(e => {
            console.warn(`Помилка завантаження деталей товару ID ${e.id || 'unknown'} для експорту ШК: ${e.message}`);
            return null; 
        })));
        detailedProducts.forEach(detailedProduct => {
            if (detailedProduct && detailedProduct.barcodes && detailedProduct.barcodes.length > 0) {
                detailedProduct.barcodes.forEach(bc => {
                    allBarcodesData.push({
                        'ID Товару': detailedProduct.id, 'Назва Товару': detailedProduct.name,
                        'ID Штрихкоду (в таблиці barcodes)': bc.id,
                        'Значення Штрихкоду': bc.barcode_value,
                        'Опис Штрихкоду': bc.description || ''
                    });
                });
            }
        });
        if (allBarcodesData.length === 0) {
            alert("Не знайдено штрихкодів для експорту.");
            if(apiResponseDiv) apiResponseDiv.textContent = "Не знайдено штрихкодів для експорту."; return;
        }
        exportToExcel(allBarcodesData, "Список_Штрихкодів");
        if(apiResponseDiv) apiResponseDiv.textContent = "Список штрихкодів успішно експортовано.";
    } catch (error) {
        console.error("Помилка експорту штрихкодів:", error);
        if(apiResponseDiv) apiResponseDiv.textContent = `Помилка експорту штрихкодів: ${error.message}`;
        alert(`Помилка експорту штрихкодів: ${error.message}`);
    }
}

function exportToExcel(data, fileName) {
    if (typeof XLSX === 'undefined') {
        console.error("Бібліотека XLSX (SheetJS) не завантажена!");
        alert("Помилка: Бібліотека для експорту в Excel не завантажена."); return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Дані");
    const colWidths = [];
    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        headers.forEach((header, i) => {
            let maxLength = header.length;
            data.forEach(row => {
                const cellValue = row[header] ? String(row[header]) : "";
                if (cellValue.length > maxLength) maxLength = cellValue.length;
            });
            colWidths[i] = { wch: maxLength + 2 }; 
        });
        worksheet['!cols'] = colWidths;
    }
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function handleImportFile(fileInputElement, importType) {
    if (!fileInputElement || !fileInputElement.files || !fileInputElement.files.length) {
        alert("Будь ласка, оберіть файл для імпорту.");
        if(fileInputElement) fileInputElement.value = ''; // Очищаємо, щоб можна було вибрати той самий файл знову
        return;
    }
    const file = fileInputElement.files[0];
    const reader = new FileReader();

    reader.onload = async function(event) {
        const data = event.target.result;
        try {
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // header: 1 - отримуємо масив масивів
            // raw: false - форматуємо дати та числа як рядки (як вони виглядають в Excel)
            // dateNF: 'yyyy-mm-dd' - якщо є дати, вказуємо формат (хоча для товарів у вас дат немає)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

            if (jsonData.length < 2) { // Має бути хоча б рядок заголовків і один рядок даних
                alert("Файл порожній або містить тільки заголовки.");
                if (apiResponseDiv) apiResponseDiv.textContent = "Помилка: Файл для імпорту порожній.";
                if(fileInputElement) fileInputElement.value = '';
                return;
            }

            const headers = jsonData[0].map(h => String(h).trim()); // Перший рядок - заголовки
            const dataRows = jsonData.slice(1).map(rowArray => { // Решта - дані
                let obj = {};
                headers.forEach((header, index) => {
                    const cellValue = rowArray[index];
                    // Обробляємо порожні значення, щоб вони стали null
                    obj[header] = (cellValue === null || cellValue === undefined || String(cellValue).trim() === '') ? null : String(cellValue).trim();
                });
                return obj;
            }).filter(obj => Object.values(obj).some(val => val !== null)); // Видаляємо повністю порожні рядки Excel

            if (dataRows.length === 0) {
                alert("У файлі не знайдено даних для імпорту (після видалення порожніх рядків).");
                if (apiResponseDiv) apiResponseDiv.textContent = "Помилка: У файлі не знайдено даних для імпорту.";
                if(fileInputElement) fileInputElement.value = '';
                return;
            }

            // --- Перетворення ключів для відповідності очікуванням backend ---
            const mappedDataRows = dataRows.map(row => {
                const mappedRow = {
                    // Ключі зліва - ті, що очікує backend (productController.js)
                    // Значення справа - отримуємо з об'єкта row, використовуючи заголовки Excel як ключі
                    name: row["Назва Товару"] || null,
                    retail_price: row["Роздрібна Ціна"], // Backend сам обробить конвертацію в число та перевірку
                    unit: row["Одиниця Виміру"] || null,   // Backend встановить 'шт', якщо тут буде null
                    barcode: row["Основний ШК"] || null,
                    id: row["ID"] || null                 // Backend сам зробить parseInt, якщо значення є
                };
                return mappedRow;
            }).filter(row => row.name && (row.retail_price !== null && row.retail_price !== undefined)); // Додаткова фільтрація: основні поля мають бути

            if (mappedDataRows.length === 0) {
                 alert("Після перевірки, у файлі не знайдено валідних даних для імпорту (наприклад, відсутня 'Назва Товару' або 'Роздрібна Ціна' у всіх рядках).");
                 if (apiResponseDiv) apiResponseDiv.textContent = "Помилка: Немає валідних даних для імпорту після мапінгу.";
                 if(fileInputElement) fileInputElement.value = '';
                 return;
            }
            // --- Кінець перетворення ключів ---

            if (apiResponseDiv) apiResponseDiv.textContent = `Обробка імпорту (${importType})... Кількість рядків для надсилання: ${mappedDataRows.length}`;

            if (importType === 'products') {
                console.log("Дані для імпорту товарів (після перетворення ключів) надсилаються на сервер:", mappedDataRows);
                try {
                    const result = await importProductsAPI(mappedDataRows); // Надсилаємо ПЕРЕТВОРЕНІ дані
                    
                    // Обробляємо відповідь від сервера (productController.js -> importProducts)
                    let feedbackMessage = result.message || `Імпорт завершено.`;
                    
                    if (result.importedCount !== undefined || result.updatedCount !== undefined || result.errorCount !== undefined) {
                        feedbackMessage += ` Імпортовано: ${result.importedCount || 0}, Оновлено: ${result.updatedCount || 0}, Помилок: ${result.errorCount || 0}.`;
                    }

                    if (result.errors && result.errors.length > 0) {
                        console.warn("Помилки під час імпорту товарів з сервера:", result.errors);
                        let errorDetails = "\nДеталі помилок на сервері:\n";
                        result.errors.forEach(err => {
                            // err має поля: product_name (або product_id), error
                            errorDetails += `- Товар: ${err.product_name || ('ID: ' + err.product_id) || 'Невідомий товар'}, Помилка: ${err.error}\n`;
                        });
                        feedbackMessage += errorDetails;
                        if(apiResponseDiv) apiResponseDiv.innerHTML = escapeHTML(feedbackMessage).replace(/\n/g, '<br>');
                    } else {
                         if(apiResponseDiv) apiResponseDiv.textContent = feedbackMessage;
                    }
                    // Обмежуємо довжину alert, щоб уникнути занадто великих повідомлень
                    alert(feedbackMessage.substring(0, 600) + (feedbackMessage.length > 600 ? "..." : ""));

                    loadProducts(); // Оновлюємо список товарів на сторінці
                } catch (apiError) {
                    // apiError.message тут буде тим, що кинув apiService 
                    // (тобто message з JSON-відповіді сервера, якщо помилка 400/500 від importProducts)
                    console.error("Помилка API при імпорті товарів:", apiError);
                    const errorMessage = apiError.message || (typeof apiError === 'string' ? apiError : 'Невідома помилка API');
                    alert(`Помилка API при імпорті товарів: ${errorMessage}`);
                    if (apiResponseDiv) apiResponseDiv.textContent = `Помилка API: ${errorMessage}`;
                }
            } else if (importType === 'barcodes') {
                // Логіка для імпорту штрихкодів (поки не реалізовано на бекенді)
                // Якщо будете реалізовувати, також знадобиться перетворення ключів для `mappedDataRows`
                console.log("Дані для імпорту штрихкодів (поки без перетворення):", dataRows);
                alert(`Імпорт штрихкодів: ${dataRows.length} рядків. Функціонал API для штрихкодів ще не реалізовано.`);
            }
            if(fileInputElement) fileInputElement.value = ''; // Очищуємо інпут файлу після спроби імпорту
        } catch (e) {
            console.error("Помилка читання або обробки файлу Excel:", e);
            alert("Помилка при обробці файлу. Перевірте формат файлу та дані.");
            if (apiResponseDiv) apiResponseDiv.textContent = `Помилка обробки файлу: ${e.message}`;
            if(fileInputElement) fileInputElement.value = '';
        }
    };
    reader.onerror = function() {
        alert("Не вдалося прочитати файл.");
        if (apiResponseDiv) apiResponseDiv.textContent = "Помилка: Не вдалося прочитати файл.";
        if(fileInputElement) fileInputElement.value = '';
    };
    reader.readAsBinaryString(file);
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

function decodeHTML(html) {
    if (html === null || html === undefined) return '';
    if (typeof html !== 'string') html = String(html);
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}