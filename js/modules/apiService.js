// js/modules/apiService.js

// Важливо: Для розгорнутого на Render додатку тут має бути URL вашого сервісу Render.
// Для локального тестування - localhost.
//const API_BASE_URL = 'http://localhost:3001/api'; // Для локального тестування
const API_BASE_URL = 'https://sokrat-pos-backend.onrender.com/api'; // Для розгорнутого на Render

async function request(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
        method: method,
        headers: {} // Ініціалізуємо порожній об'єкт заголовків
    };

    // Додаємо токен авторизації, якщо він є
    const token = localStorage.getItem('authToken');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        let responseData;
        const contentType = response.headers.get("content-type");

        if (response.status === 204) { // No Content
            responseData = { message: `Operation successful with status ${response.status}`, status: response.status };
        } else if (contentType && contentType.indexOf("application/json") !== -1) {
            responseData = await response.json();
        } else {
            const textResponse = await response.text();
            try {
                responseData = JSON.parse(textResponse); 
            } catch (e) {
                 responseData = { 
                    error: textResponse || `Received non-JSON response with status ${response.status}`,
                    status: response.status 
                };
            }
        }

        if (!response.ok) {
            const errorMessage = (responseData && responseData.error) 
                                 ? responseData.error 
                                 : (responseData && responseData.message) 
                                   ? responseData.message
                                   : `HTTP error! Status: ${response.status}. URL: ${url}`;
            const error = new Error(errorMessage);
            error.status = response.status; 
            error.responseData = responseData; 
            throw error;
        }
        return responseData;
    } catch (error) {
        console.error(`API request error to ${method} ${url}:`, error.message, error.status ? `Status: ${error.status}` : '', error.responseData ? error.responseData : ''); 
        throw error; 
    }
}

// --- Store API Calls ---
export const fetchStoresAPI = () => request('/stores');
export const createStoreAPI = (storeData) => request('/stores', 'POST', storeData);
export const updateStoreAPI = (id, storeData) => request(`/stores/${id}`, 'PUT', storeData);
export const deleteStoreAPI = (id) => request(`/stores/${id}`, 'DELETE');

// --- User API Calls ---
export const fetchUsersAPI = () => request('/users');
export const createUserAPI = (userData) => request('/users', 'POST', userData);
export const updateUserAPI = (id, userData) => request(`/users/${id}`, 'PUT', userData);
export const deleteUserAPI = (id) => request(`/users/${id}`, 'DELETE');

// --- Product API Calls ---
export const fetchProductsAPI = (page = 1, limit = 100) => {
  return request(`/products?page=${page}&limit=${limit}`);
};
export const createProductAPI = (productData) => request('/products', 'POST', productData);
export const updateProductAPI = (id, productData) => request(`/products/${id}`, 'PUT', productData);
export const deleteProductAPI = (id) => request(`/products/${id}`, 'DELETE');
export const getProductByIdAPI = (id) => request(`/products/${id}`);
export const addProductBarcodeAPI = (productId, barcodeData) => request(`/products/${productId}/barcodes`, 'POST', barcodeData);
export const deleteProductBarcodeAPI = (productId, barcodeId) => request(`/products/${productId}/barcodes/${barcodeId}`, 'DELETE');
export const findProductsByBarcodeAPI = (barcodeValue) => request(`/products/by-barcode/${barcodeValue}`);
export const importProductsAPI = (productsDataArray) => request('/products/import', 'POST', productsDataArray);
export const fetchProductStockByStoresAPI = (productId) => {
  return request(`/products/${productId}/stock-by-stores`);
};
// Нова функція для пошуку товарів (автодоповнення)
export const searchProductsByNameOrBarcodeAPI = (searchTerm, limit = 10) => {
  const encodedSearchTerm = encodeURIComponent(searchTerm);
  return request(`/products/search?term=${encodedSearchTerm}&limit=${limit}`);
};
// --- End Product API Calls ---


// --- Purchase API Calls ---
export const createPurchaseAPI = (purchaseData) => request('/purchases', 'POST', purchaseData);
export const fetchPurchasesAPI = () => request('/purchases');
export const fetchPurchaseByIdAPI = (id) => request(`/purchases/${id}`);
export const fetchAllPurchaseItemsAPI = () => request('/purchases/all-items');

// --- Sale API Calls ---
export const createSaleAPI = (saleData) => request('/sales', 'POST', saleData);
export const fetchSalesAPI = () => request('/sales');
export const fetchSaleByIdAPI = (id) => request(`/sales/${id}`);

// --- Auth API Calls ---
// Якщо ви будете мати окремий authApiService.js, то цей рядок тут не потрібен.
// export const loginAPI = (credentials) => request('/auth/login', 'POST', credentials);