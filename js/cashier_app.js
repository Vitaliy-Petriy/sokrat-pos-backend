// js/cashier_app.js

// --- ПОЧАТОК: Перевірка автентифікації та ролі ---
const authTokenCashier = localStorage.getItem('authToken');
const userRoleCashier = localStorage.getItem('userRole');

// Дозволяємо доступ касирам, а також адмінам та менеджерам (вони можуть виконувати функції касира)
if (!authTokenCashier || !['cashier', 'admin', 'manager'].includes(userRoleCashier)) {
    console.warn('Користувач не автентифікований або не має прав доступу до інтерфейсу касира. Перенаправлення на login.html');
    localStorage.clear(); // Очищаємо localStorage на випадок невалідних даних
    window.location.href = '/login.html';
    // Див. коментар в app.js щодо зупинки виконання скрипта
}
// --- КІНЕЦЬ: Перевірка автентифікації та ролі ---

import { initCashierControls } from './modules/uiCashierManager.js'; // Переконайтесь, що шлях правильний

document.addEventListener('DOMContentLoaded', () => {
    // Якщо ми тут, користувач автентифікований і має відповідну роль

    const apiCashierResponseDiv = document.getElementById('apiCashierResponse');
    const logoutBtnCashier = document.getElementById('logoutBtnCashier');

    console.log("DOM завантажено. cashier_app.js стартує.");

    if (!apiCashierResponseDiv) {
        console.error("Елемент #apiCashierResponse не знайдено на сторінці касира!");
    }

    // --- Обробник кнопки "Вийти" ---
    if (logoutBtnCashier) {
        logoutBtnCashier.addEventListener('click', () => {
            localStorage.clear(); // Очищаємо всі дані сесії з localStorage
            window.location.href = '/login.html'; // Перенаправлення на сторінку входу
        });
    }
    // --- Кінець обробника кнопки "Вийти" ---

    // Ініціалізація контролів касира
    // Передаємо також інформацію про користувача, якщо uiCashierManager її потребує
    const userId = localStorage.getItem('userId');
    const storeId = localStorage.getItem('storeId'); // Може бути null
    const username = localStorage.getItem('username');

    // Можливо, initCashierControls потрібно буде адаптувати для прийому цих даних
    // або uiCashierManager сам їх читатиме з localStorage, якщо вони там потрібні.
    // Поки що передаємо тільки responseDiv.
    initCashierControls(apiCashierResponseDiv /*, { userId, storeId, username } */);

    console.log("cashier_app.js завершив роботу.");
});