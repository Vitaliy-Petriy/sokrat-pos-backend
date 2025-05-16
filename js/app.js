// js/app.js

// --- ПОЧАТОК: Перевірка автентифікації та ролі ---
const authToken = localStorage.getItem('authToken');
const userRole = localStorage.getItem('userRole');

if (!authToken || (userRole !== 'admin' && userRole !== 'manager')) {
    console.warn('Користувач не автентифікований або не має прав доступу до адмін-панелі. Перенаправлення на login.html');
    localStorage.clear();
    window.location.href = '/login.html';
    // Щоб гарантовано зупинити виконання скрипта, можна кинути помилку:
    // throw new Error("Redirecting to login page. Further script execution stopped.");
}
// --- КІНЕЦЬ: Перевірка автентифікації та ролі ---

import { initStoreControls, loadStores } from './modules/uiStoreManager.js';
import { initUserControls, loadUsers } from './modules/uiUserManager.js';
import { initProductControls /*, loadProducts */ } from './modules/uiProductManager.js'; 
// loadProducts тепер викликається зсередини initProductControls або при кліках на підвкладки
import { initPurchaseControls, loadPurchases, loadAllPurchaseItems } from './modules/uiPurchaseManager.js';
import { initSaleControls, loadSales } from './modules/uiSaleManager.js';

let globalApiResponseDiv = null; 

async function loadTabContent(templateUrl, targetTabId) {
    const container = document.getElementById('tabContentContainer');
    if (!container) {
        console.error('Контейнер #tabContentContainer не знайдено!');
        return;
    }
    container.innerHTML = '<div class="container" style="text-align:center; padding: 50px; font-style:italic;">Завантаження вмісту вкладки...</div>';

    try {
        const response = await fetch(templateUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - Не вдалося завантажити шаблон: ${templateUrl}`);
        }
        const html = await response.text();
        container.innerHTML = html;
        console.log(`Завантажено та відображено контент для ${targetTabId} з ${templateUrl}`);

        if (!globalApiResponseDiv) { 
            globalApiResponseDiv = document.getElementById('apiResponse');
        }

        // Ініціалізація контролів та завантаження даних для КОНКРЕТНОЇ завантаженої вкладки
        switch (targetTabId) {
            case 'stores':
                initStoreControls(globalApiResponseDiv);
                if (document.getElementById('storesTable')) loadStores();
                break;
            case 'users':
                initUserControls(globalApiResponseDiv);
                if (document.getElementById('usersTable')) loadUsers();
                break;
            case 'products':
                initProductControls(globalApiResponseDiv); 
                // Початкове завантаження товарів тепер повністю кероване всередині initProductControls
                break;
            case 'purchases':
                initPurchaseControls(globalApiResponseDiv);
                if (document.getElementById('purchasesTable')) loadPurchases();
                // Список всіх партій тепер на вкладці "Склад", тому тут не завантажуємо
                // if (document.getElementById('purchaseItemsTable')) loadAllPurchaseItems(); // Видалено
                break;
            case 'sales':
                initSaleControls(globalApiResponseDiv);
                if (document.getElementById('salesTable')) loadSales();
                break;
            case 'stock': // Нова вкладка "Склад"
                // Якщо для вкладки "Склад" потрібні свої специфічні UI контроли,
                // потрібно створити uiStockManager.js та initStockControls()
                // Поки що, припускаємо, що loadAllPurchaseItems з uiPurchaseManager достатньо
                // і вона знає, куди рендерити дані (або приймає параметр)
                if (document.getElementById('purchaseItemsTableStockPage')) {
                    loadAllPurchaseItems('purchaseItemsTableStockPageBody'); // Передаємо ID tbody
                } else {
                    console.warn("Таблиця для складу (purchaseItemsTableStockPage) не знайдена.");
                }
                const fetchStockButton = document.getElementById('fetchAllPurchaseItemsBtnStockPage');
                if(fetchStockButton && typeof loadAllPurchaseItems === 'function') {
                    // Видаляємо старі обробники, щоб уникнути дублювання, якщо loadTabContent викликається повторно для цієї вкладки
                    const newFetchStockButton = fetchStockButton.cloneNode(true);
                    fetchStockButton.parentNode.replaceChild(newFetchStockButton, fetchStockButton);
                    newFetchStockButton.addEventListener('click', () => loadAllPurchaseItems('purchaseItemsTableStockPageBody'));
                }
                break;
            case 'reports':
                console.log('Вкладка "Звіти" активована.');
                if (globalApiResponseDiv) globalApiResponseDiv.textContent = "Вкладка Звітів.";
                break;
            case 'dashboard':
                console.log('Вкладка "Головна" активована.');
                if (globalApiResponseDiv) globalApiResponseDiv.textContent = "Вітаємо на головній сторінці!";
                break;
            default:
                console.warn(`Немає специфічної логіки ініціалізації для вкладки: ${targetTabId}`);
        }

    } catch (error) {
        console.error(`Помилка завантаження вмісту вкладки ${targetTabId} (${templateUrl}):`, error);
        container.innerHTML = `<div class="container"><p style="color:red; font-weight:bold;">Помилка завантаження вмісту вкладки.</p><p>${error.message}</p></div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    globalApiResponseDiv = document.getElementById('apiResponse'); 

    const tabs = document.querySelectorAll('nav.sidebar ul li a:not(#logoutBtnAdminSidebar)'); // Виключаємо кнопку виходу, якщо вона є посиланням
    const logoutBtnAdmin = document.getElementById('logoutBtnAdmin');
    const logoutBtnAdminSidebar = document.getElementById('logoutBtnAdminSidebar'); // Якщо у вас є кнопка виходу в сайдбарі з таким ID

    console.log("DOM завантажено. app.js (з динамічним завантаженням) стартує.");

    if (!globalApiResponseDiv) {
        console.error("Елемент #apiResponse не знайдено! Повідомлення API не будуть відображатися.");
    }

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login.html';
    };

    if (logoutBtnAdmin) logoutBtnAdmin.addEventListener('click', handleLogout);
    if (logoutBtnAdminSidebar) {
        logoutBtnAdminSidebar.addEventListener('click', (e) => {
            e.preventDefault(); // Якщо це посилання <a>
            handleLogout();
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', (event) => {
            event.preventDefault();
            const targetTabId = tab.dataset.tab;
            const templateUrl = tab.dataset.template; 
            console.log(`Клік на вкладці: ${targetTabId}, шаблон: ${templateUrl}`);

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (templateUrl) { 
                loadTabContent(templateUrl, targetTabId);
            } else { // Обробка для вкладок без data-template (наприклад, якщо dashboard не має partial)
                console.warn(`Для вкладки ${targetTabId} не вказано data-template. Вміст не буде завантажено динамічно.`);
                const container = document.getElementById('tabContentContainer');
                if (container) {
                    if (targetTabId === 'dashboard') {
                         container.innerHTML = '<h2>Головна сторінка</h2><p>Ласкаво просимо до панелі адміністратора! (Статичний вміст, якщо шаблон не вказано)</p>';
                         if(globalApiResponseDiv) globalApiResponseDiv.textContent = "Вітаємо на головній сторінці!";
                    } else {
                        container.innerHTML = `<p>Контент для вкладки "${targetTabId}" не визначено через відсутність data-template.</p>`;
                    }
                }
            }
        });
    });

    // Активація вкладки за замовчуванням
    const defaultTabLink = document.querySelector('nav.sidebar ul li a[data-tab="dashboard"]');
    if (defaultTabLink) {
        console.log("Симуляція кліку на dashboard для початкового завантаження");
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
});