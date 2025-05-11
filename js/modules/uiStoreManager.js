// js/modules/uiStoreManager.js
import { fetchStoresAPI, createStoreAPI, updateStoreAPI, deleteStoreAPI } from './apiService.js';

// Змінюємо змінні для DOM-елементів форми
let storesTableBody, apiResponseDiv,
    addNewStoreBtn, storeModal, storeModalTitle, closeStoreModalBtn, cancelStoreModalBtn,
    storeModalForm, modalStoreIdInput, modalStoreNameInput, modalStoreAddressInput;

export function initStoreControls(responseDivElement) {
    apiResponseDiv = responseDivElement;
    storesTableBody = document.querySelector('#storesTable tbody');

    // Нові елементи для модального вікна
    addNewStoreBtn = document.getElementById('addNewStoreBtn');
    storeModal = document.getElementById('storeModal');
    storeModalTitle = document.getElementById('storeModalTitle');
    closeStoreModalBtn = document.getElementById('closeStoreModalBtn');
    cancelStoreModalBtn = document.getElementById('cancelStoreModalBtn');
    storeModalForm = document.getElementById('storeModalForm');
    modalStoreIdInput = document.getElementById('modalStoreId');
    modalStoreNameInput = document.getElementById('modalStoreName');
    modalStoreAddressInput = document.getElementById('modalStoreAddress');

    // Перевірка наявності всіх елементів
    if (!storesTableBody || !addNewStoreBtn || !storeModal || !storeModalForm) {
        console.error('Не вдалося знайти всі необхідні елементи для управління магазинами через модальне вікно!');
        return;
    }

    // Обробники подій для модального вікна
    addNewStoreBtn.addEventListener('click', openStoreModalForCreate);
    if (closeStoreModalBtn) closeStoreModalBtn.addEventListener('click', closeStoreModal);
    if (cancelStoreModalBtn) cancelStoreModalBtn.addEventListener('click', closeStoreModal);
    storeModalForm.addEventListener('submit', handleStoreModalSubmit);

    // Закриття модального вікна по кліку поза ним
    if (storeModal) {
        storeModal.addEventListener('click', (event) => {
            if (event.target === storeModal) {
                closeStoreModal();
            }
        });
    }

    setupStoreTableEventListeners();
}

function openStoreModalForCreate() {
    if (!storeModalTitle || !storeModalForm || !modalStoreIdInput || !modalStoreNameInput || !storeModal) {
        console.error("Елементи модального вікна магазину не ініціалізовані для створення."); return;
    }
    storeModalTitle.textContent = 'Додати Новий Магазин';
    storeModalForm.reset(); // Очищаємо форму
    modalStoreIdInput.value = ''; // Очищаємо приховане поле ID
    storeModal.style.display = 'block';
    if(modalStoreNameInput) modalStoreNameInput.focus();
}

function openStoreModalForEdit(store) {
    if (!storeModalTitle || !storeModalForm || !modalStoreIdInput || !modalStoreNameInput || !modalStoreAddressInput || !storeModal) {
        console.error("Елементи модального вікна магазину не ініціалізовані для редагування."); return;
    }
    storeModalTitle.textContent = 'Редагувати Магазин';
    storeModalForm.reset();
    modalStoreIdInput.value = store.id;
    modalStoreNameInput.value = decodeHTML(store.name);
    modalStoreAddressInput.value = decodeHTML(store.address || '');
    storeModal.style.display = 'block';
    if(modalStoreNameInput) modalStoreNameInput.focus();
}

function closeStoreModal() {
    if(storeModal) storeModal.style.display = 'none';
}

async function handleStoreModalSubmit(event) {
    event.preventDefault();
    if (!modalStoreIdInput || !modalStoreNameInput || !modalStoreAddressInput) {
         console.error("Елементи форми модального вікна магазину не ініціалізовані для відправки."); return;
    }

    const id = modalStoreIdInput.value;
    const storeData = {
        name: modalStoreNameInput.value,
        address: modalStoreAddressInput.value || null
    };

    if (!storeData.name) {
        alert('Назва магазину є обов\'язковою!');
        if(apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Назва магазину є обов\'язковою!';
        return;
    }

    try {
        let resultMessage = '';
        if (id) { // Редагування
            const updatedStore = await updateStoreAPI(id, storeData);
            resultMessage = `Магазин "${updatedStore.name}" (ID: ${updatedStore.id}) оновлено.`;
        } else { // Створення
            const newStore = await createStoreAPI(storeData);
            resultMessage = `Магазин "${newStore.name}" (ID: ${newStore.id}) створено.`;
        }
        if (apiResponseDiv) apiResponseDiv.textContent = resultMessage;
        closeStoreModal();
        loadStores();
    } catch (error) {
        console.error('Помилка збереження магазину:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка збереження магазину: ${error.message}`;
        // Можна не закривати модальне вікно при помилці, щоб користувач міг виправити дані
    }
}

export async function loadStores() { // Функція loadStores залишається майже такою ж
    if (!storesTableBody) {
        return;
    }
    try {
        const stores = await fetchStoresAPI();
        storesTableBody.innerHTML = '';
        stores.forEach(store => {
            const row = storesTableBody.insertRow();
            // Зберігаємо всі дані магазину в data-атрибутах кнопки редагування
            row.innerHTML = `
                <td>${store.id}</td>
                <td>${escapeHTML(store.name)}</td>
                <td>${escapeHTML(store.address || '')}</td>
                <td>
                    <button class="edit-btn" data-action="edit" data-store='${JSON.stringify(store)}'>Ред.</button>
                    <button class="delete-btn" data-action="delete" data-id="${store.id}">Вид.</button>
                </td>
            `;
        });
        if (apiResponseDiv) apiResponseDiv.textContent = 'Список магазинів оновлено.';
    } catch (error) {
        console.error('Помилка завантаження магазинів:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження магазинів: ${error.message}`;
    }
}

async function handleDeleteStoreRow(id) { // Функція видалення залишається такою ж
    if (!confirm(`Ви дійсно хочете видалити магазин ID: ${id}? Це може вплинути на пов'язані дані!`)) return;
    try {
        // У вашому deleteStoreAPI вже є обробка відповіді і повернення message, якщо потрібно
        const result = await deleteStoreAPI(id); // Припускаємо, що API повертає об'єкт з message
        if (apiResponseDiv) apiResponseDiv.textContent = result.message || `Магазин ID: ${id} видалено.`;
        loadStores();
    } catch (error) {
        console.error('Помилка видалення магазину:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка видалення магазину: ${error.message}`;
    }
}

export function setupStoreTableEventListeners() {
    if (storesTableBody) {
        storesTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === 'edit') {
                // Отримуємо дані магазину з data-атрибута
                const storeDataString = button.dataset.store;
                if (storeDataString) {
                    try {
                        const storeObject = JSON.parse(storeDataString);
                        openStoreModalForEdit(storeObject);
                    } catch (e) {
                        console.error("Помилка парсингу даних магазину для редагування:", e);
                    }
                }
            } else if (action === 'delete') {
                handleDeleteStoreRow(id);
            }
        });
    } else {
        console.warn("storesTableBody не знайдено для налаштування слухачів подій.");
    }
}

// Допоміжні функції (можна винести в utils.js, якщо ще не там)
function escapeHTML(str) {
    // ... (ваш код escapeHTML)
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&': return '&'; // Важливо екранувати &
            case '<': return '<';
            case '>': return '>';
            case '"': return '"';
            case "\'": return '\''; // або '
            default: return match;
        }
    });
}

function decodeHTML(html) {
    // ... (ваш код decodeHTML)
    if (html === null || html === undefined) return '';
    if (typeof html !== 'string') html = String(html);
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}