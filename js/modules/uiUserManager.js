// js/modules/uiUserManager.js
import { fetchUsersAPI, createUserAPI, updateUserAPI, deleteUserAPI, fetchStoresAPI } from './apiService.js'; // Додаємо fetchStoresAPI

// Змінюємо змінні для DOM-елементів форми
let usersTableBody, apiResponseDiv,
    addNewUserBtn, userModal, userModalTitle, closeUserModalBtn, cancelUserModalBtn,
    userModalForm, modalUserIdInput, modalUserUsernameInput, modalUserPasswordInput,
    modalUserFullNameInput, modalUserStoreIdSelect, /* Змінено на select */ modalUserRoleSelect, modalUserIsActiveCheckbox;

export function initUserControls(responseDivElement) {
    apiResponseDiv = responseDivElement;
    usersTableBody = document.querySelector('#usersTable tbody');

    addNewUserBtn = document.getElementById('addNewUserBtn');
    userModal = document.getElementById('userModal');
    userModalTitle = document.getElementById('userModalTitle');
    closeUserModalBtn = document.getElementById('closeUserModalBtn');
    cancelUserModalBtn = document.getElementById('cancelUserModalBtn');
    userModalForm = document.getElementById('userModalForm');
    modalUserIdInput = document.getElementById('modalUserId');
    modalUserUsernameInput = document.getElementById('modalUserUsername');
    modalUserPasswordInput = document.getElementById('modalUserPassword');
    modalUserFullNameInput = document.getElementById('modalUserFullName');
    // modalUserStoreIdInput = document.getElementById('modalUserStoreId'); // Замінимо на select пізніше, поки що ID
    modalUserStoreIdSelect = document.getElementById('modalUserStoreId'); // Якщо це все ще input type="number"
    modalUserRoleSelect = document.getElementById('modalUserRole');
    modalUserIsActiveCheckbox = document.getElementById('modalUserIsActive');

    if (!usersTableBody || !addNewUserBtn || !userModal || !userModalForm) {
        console.error('Не вдалося знайти всі необхідні елементи для управління користувачами через модальне вікно!');
        return;
    }

    addNewUserBtn.addEventListener('click', openUserModalForCreate);
    if (closeUserModalBtn) closeUserModalBtn.addEventListener('click', closeUserModal);
    if (cancelUserModalBtn) cancelUserModalBtn.addEventListener('click', closeUserModal);
    userModalForm.addEventListener('submit', handleUserModalSubmit);

    if (userModal) {
        userModal.addEventListener('click', (event) => {
            if (event.target === userModal) {
                closeUserModal();
            }
        });
    }
    
    // populateStoreSelectForUserModal(); // Завантажимо магазини для select в модалці (якщо буде select)
    setupUserTableEventListeners();
}

// Опціонально: Якщо ви хочете select для магазинів у модальному вікні користувача
/*
async function populateStoreSelectForUserModal() {
    if (!modalUserStoreIdSelect || modalUserStoreIdSelect.tagName !== 'SELECT') return; // Перевірка, що це select
    try {
        const stores = await fetchStoresAPI();
        modalUserStoreIdSelect.innerHTML = '<option value="">-- Не прив\'язаний --</option>'; // Порожнє значення
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = `${store.name} (ID: ${store.id})`;
            modalUserStoreIdSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Помилка завантаження магазинів для модального вікна користувача:", error);
    }
}
*/

function openUserModalForCreate() {
    if (!userModalTitle || !userModalForm || !modalUserIdInput || !modalUserUsernameInput || !userModal) {
        console.error("Елементи модального вікна користувача не ініціалізовані для створення."); return;
    }
    userModalTitle.textContent = 'Додати Нового Користувача';
    userModalForm.reset();
    modalUserIdInput.value = '';
    if(modalUserIsActiveCheckbox) modalUserIsActiveCheckbox.checked = true; // За замовчуванням активний
    if(modalUserPasswordInput) modalUserPasswordInput.placeholder = "Обов'язковий для нового";
    userModal.style.display = 'block';
    if(modalUserUsernameInput) modalUserUsernameInput.focus();
}

function openUserModalForEdit(user) {
    if (!userModalTitle || !userModalForm || !modalUserIdInput || !modalUserUsernameInput || 
        !modalUserPasswordInput || !modalUserFullNameInput || !modalUserStoreIdSelect ||
        !modalUserRoleSelect || !modalUserIsActiveCheckbox || !userModal) {
        console.error("Елементи модального вікна користувача не ініціалізовані для редагування."); return;
    }
    userModalTitle.textContent = 'Редагувати Користувача';
    userModalForm.reset();
    modalUserIdInput.value = user.id;
    modalUserUsernameInput.value = decodeHTML(user.username);
    modalUserPasswordInput.value = ''; // Пароль не показуємо, вводимо тільки для зміни
    modalUserPasswordInput.placeholder = "Залиште порожнім, щоб не змінювати";
    modalUserFullNameInput.value = decodeHTML(user.full_name || '');
    
    // Для ID магазину: якщо у вас input type="number"
    if (modalUserStoreIdSelect.tagName === 'INPUT') {
         modalUserStoreIdSelect.value = user.store_id || '';
    } else if (modalUserStoreIdSelect.tagName === 'SELECT') { // Якщо ви реалізували select
         modalUserStoreIdSelect.value = user.store_id || ''; // Встановлюємо значення для select
    }

    modalUserRoleSelect.value = user.role;
    modalUserIsActiveCheckbox.checked = user.is_active;
    userModal.style.display = 'block';
    if(modalUserUsernameInput) modalUserUsernameInput.focus();
}

function closeUserModal() {
    if(userModal) userModal.style.display = 'none';
}

async function handleUserModalSubmit(event) {
    event.preventDefault();
    // Перевірка наявності елементів форми
    if (!modalUserIdInput || !modalUserUsernameInput || !modalUserPasswordInput ||
        !modalUserFullNameInput || !modalUserStoreIdSelect || !modalUserRoleSelect ||
        !modalUserIsActiveCheckbox) {
        console.error("Елементи форми модального вікна користувача не ініціалізовані для відправки.");
        if (apiResponseDiv) apiResponseDiv.textContent = 'Помилка: форма не повністю ініціалізована.';
        return;
    }

    const id = modalUserIdInput.value;
    const userData = {
        username: modalUserUsernameInput.value,
        full_name: modalUserFullNameInput.value || null,
        // Для ID магазину:
        store_id: modalUserStoreIdSelect.value ? parseInt(modalUserStoreIdSelect.value) : null,
        role: modalUserRoleSelect.value,
        is_active: modalUserIsActiveCheckbox.checked
    };

    if (!userData.username || !userData.role) {
        alert('Логін та роль є обов\'язковими!');
        if (apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Логін та роль є обов\'язковими!';
        return;
    }

    const password = modalUserPasswordInput.value;
    if (password) { // Якщо пароль введено (не порожній)
        userData.password = password;
    } else if (!id) { // Пароль обов'язковий для нового користувача, якщо поле порожнє
        alert('Пароль є обов\'язковим для нового користувача!');
        if (apiResponseDiv) apiResponseDiv.textContent = 'Помилка: Пароль є обов\'язковим для нового користувача!';
        return;
    }

    try {
        let resultMessage = '';
        if (id) { // Редагування
            const updatedUser = await updateUserAPI(id, userData);
            resultMessage = `Користувача "${updatedUser.username}" оновлено.`;
        } else { // Створення
            const newUser = await createUserAPI(userData);
            resultMessage = `Користувача "${newUser.username}" створено.`;
        }
        if (apiResponseDiv) apiResponseDiv.textContent = resultMessage;
        closeUserModal();
        loadUsers();
    } catch (error) {
        console.error('Помилка збереження користувача:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка збереження користувача: ${error.message}`;
    }
}

export async function loadUsers() { // Завантаження користувачів, адаптуємо кнопку "Ред."
    if (!usersTableBody) return;
    try {
        const users = await fetchUsersAPI();
        usersTableBody.innerHTML = '';
        users.forEach(user => {
            const row = usersTableBody.insertRow();
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.full_name || '')}</td>
                <td>${user.store_id || 'N/A'}</td>
                <td>${escapeHTML(user.role)}</td>
                <td>${user.is_active ? 'Так' : 'Ні'}</td>
                <td>
                    <button class="edit-btn" data-action="edit" data-user='${JSON.stringify(user)}'>Ред.</button>
                    <button class="delete-btn" data-action="delete" data-id="${user.id}">Вид.</button>
                </td>
            `;
        });
        if (apiResponseDiv) apiResponseDiv.textContent = 'Список користувачів оновлено.';
    } catch (error) {
        console.error('Помилка завантаження користувачів:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка завантаження користувачів: ${error.message}`;
    }
}

async function handleDeleteUserRow(id) { // Видалення залишається без змін
    if (!confirm(`Ви дійсно хочете видалити користувача ID: ${id}?`)) return;
    try {
        const result = await deleteUserAPI(id);
        if (apiResponseDiv) apiResponseDiv.textContent = result.message || `Користувача ID: ${id} видалено.`;
        loadUsers();
    } catch (error) {
        console.error('Помилка видалення користувача:', error);
        if (apiResponseDiv) apiResponseDiv.textContent = `Помилка видалення користувача: ${error.message}`;
    }
}

export function setupUserTableEventListeners() {
    if (usersTableBody) {
        usersTableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === 'edit') {
                const userDataString = button.dataset.user;
                if (userDataString) {
                    try {
                        const userObject = JSON.parse(userDataString);
                        openUserModalForEdit(userObject);
                    } catch (e) {
                        console.error("Помилка парсингу даних користувача для редагування:", e);
                    }
                }
            } else if (action === 'delete') {
                handleDeleteUserRow(id);
            }
        });
    }
}

// Допоміжні функції
function escapeHTML(str) {
    // ... (ваш код escapeHTML) ...
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
    // ... (ваш код decodeHTML) ...
    if (html === null || html === undefined) return '';
    if (typeof html !== 'string') html = String(html);
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}