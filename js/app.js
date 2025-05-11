// js/app.js

// --- ПОЧАТОК: Перевірка автентифікації та ролі ---
const authToken = localStorage.getItem('authToken');
const userRole = localStorage.getItem('userRole');

// Перенаправлення на сторінку входу, якщо немає токена або роль не підходить
if (!authToken || (userRole !== 'admin' && userRole !== 'manager')) {
    console.warn('Користувач не автентифікований або не має прав доступу до адмін-панелі. Перенаправлення на login.html');
    localStorage.clear(); // Очищаємо localStorage на випадок невалідних даних
    window.location.href = '/login.html';
    // Важливо: якщо перенаправлення відбувається, подальший код у цьому файлі не має виконуватися.
}
// --- КІНЕЦЬ: Перевірка автентифікації та ролі ---

import { initStoreControls, loadStores } from './modules/uiStoreManager.js';
import { initUserControls, loadUsers } from './modules/uiUserManager.js';
import { initProductControls, loadProducts } from './modules/uiProductManager.js';
import { initPurchaseControls, loadPurchases, loadAllPurchaseItems } from './modules/uiPurchaseManager.js';
import { initSaleControls, loadSales } from './modules/uiSaleManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('nav.sidebar ul li a:not(#logoutBtnAdminSidebar)'); // Виключаємо кнопку виходу з обробки як вкладку
    const tabContents = document.querySelectorAll('.tab-content');
    const apiResponseDiv = document.getElementById('apiResponse');
    const logoutBtnAdmin = document.getElementById('logoutBtnAdmin'); // Кнопка виходу в хедері
    const logoutBtnAdminSidebar = document.getElementById('logoutBtnAdminSidebar'); // Кнопка виходу на бічній панелі (якщо є)

    console.log("DOM завантажено. app.js стартує для адмін-панелі.");

    if (!apiResponseDiv) {
        console.error("Елемент #apiResponse не знайдено! Повідомлення API не будуть відображатися.");
    }

    // --- Обробник кнопки "Вийти" ---
    const handleLogout = () => {
        localStorage.clear(); // Очищаємо всі дані сесії з localStorage
        window.location.href = '/login.html'; // Перенаправлення на сторінку входу
    };

    if (logoutBtnAdmin) {
        logoutBtnAdmin.addEventListener('click', handleLogout);
    }
    if (logoutBtnAdminSidebar) { 
        logoutBtnAdminSidebar.addEventListener('click', (e) => {
            e.preventDefault(); 
            handleLogout();
        });
    }
    // --- Кінець обробника кнопки "Вийти" ---

    console.log("Ініціалізація ВСІХ контролів адмін-панелі...");
    initStoreControls(apiResponseDiv);
    initUserControls(apiResponseDiv);
    initProductControls(apiResponseDiv);
    initPurchaseControls(apiResponseDiv);
    initSaleControls(apiResponseDiv);
    console.log("Ініціалізація контролів адмін-панелі завершена.");

    tabs.forEach(tab => {
        tab.addEventListener('click', (event) => {
            event.preventDefault();
            console.log(`Клік на вкладці: ${tab.dataset.tab}`);
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => {
                if (content) content.classList.remove('active');
            });

            if (tab) tab.classList.add('active');
            const targetTabId = tab ? tab.getAttribute('data-tab') : null;
            
            if (targetTabId) {
                const activeContent = document.getElementById(targetTabId);
                if (activeContent) {
                    activeContent.classList.add('active');
                    console.log(`Активовано контент: ${targetTabId}`);
                    
                    // Оновлена логіка завантаження даних для активної вкладки
                    if (targetTabId === 'stores') {
                        if (document.getElementById('storesTable')) {
                            loadStores();
                        }
                    } else if (targetTabId === 'users') {
                        if (document.getElementById('usersTable')) {
                            loadUsers();
                        }
                    } else if (targetTabId === 'products') {
                        const productListSubTab = document.getElementById('productListSubTab');
                        const noActiveProductSubTab = !document.querySelector('#products .product-subtab-button.active');
                        
                        if ((productListSubTab && productListSubTab.classList.contains('active')) || noActiveProductSubTab) {
                            if (document.getElementById('productsTable')) {
                                loadProducts();
                            }
                        }
                    } else if (targetTabId === 'purchases') { 
                        if (document.getElementById('purchasesTable')) { 
                             loadPurchases();
                        }
                        if (document.getElementById('purchaseItemsTable')) {
                             loadAllPurchaseItems();
                        }
                    } else if (targetTabId === 'sales') { 
                        if (document.getElementById('salesTable')) {
                            loadSales(); 
                        }
                    }
                } else {
                    console.error(`Контент для вкладки "${targetTabId}" не знайдено.`);
                }
            }
        });
    });

    // Активація вкладки за замовчуванням
    const defaultTabLink = document.querySelector('nav.sidebar ul li a[data-tab="dashboard"]');
    if (defaultTabLink) {
        console.log("Симуляція кліку на dashboard");
        defaultTabLink.click(); 
    } else {
        const firstTabLink = document.querySelector('nav.sidebar ul li a:not(#logoutBtnAdminSidebar)');
        if (firstTabLink) {
            console.log(`Симуляція кліку на першу доступну вкладку: ${firstTabLink.dataset.tab}`);
            firstTabLink.click();
        } else {
            console.warn("Посилання на вкладки не знайдено для активації за замовчуванням.");
        }
    }
    console.log("app.js (адмін-панель) завершив роботу.");
});