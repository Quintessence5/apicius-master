import axios from 'axios';

let accessToken = null; // Store accessToken in memory

const apiClient = axios.create({
    baseURL: 'http://localhost:5010/api',
    withCredentials: true, // Include cookies for refresh token
});

// Flag to prevent infinite refresh loops
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeToTokenRefresh = (callback) => {
    refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
    refreshSubscribers.forEach((callback) => callback(token));
    refreshSubscribers = [];
};

// Request interceptor to include accessToken in headers
apiClient.interceptors.request.use(
    (config) => {
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for handling token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            if (isRefreshing) {
                // Wait until the refresh process finishes
                return new Promise((resolve) => {
                    subscribeToTokenRefresh((token) => {
                        originalRequest.headers['Authorization'] = `Bearer ${token}`;
                        resolve(apiClient(originalRequest));
                    });
                });
            }

            isRefreshing = true;

            try {
                const response = await axios.post('http://localhost:5010/api/users/refresh-token', {}, { withCredentials: true });
                const newAccessToken = response.data.accessToken;
                setAccessToken(newAccessToken);

                onRefreshed(newAccessToken);

                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return apiClient(originalRequest); // Retry the original request
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export const setAccessToken = (token) => {
    accessToken = token;
};

export default apiClient;
