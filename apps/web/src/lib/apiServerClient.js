import { getApiBaseUrl } from '@/lib/apiBaseUrl.js';

const API_SERVER_URL = getApiBaseUrl();

const apiServerClient = {
    fetch: async (url, options = {}) => {
        return await window.fetch(API_SERVER_URL + url, options);
    }
};

export default apiServerClient;

export { apiServerClient };
