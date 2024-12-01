import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'http://localhost:5010/api',
    withCredentials: true, // Ensures cookies are sent
});

apiClient.interceptors.response.use(
    (response) => response, // Pass successful responses
    (error) => {
        console.error('API Client Error:', error.response || error);
        return Promise.reject(error);
    }
);

export default apiClient;