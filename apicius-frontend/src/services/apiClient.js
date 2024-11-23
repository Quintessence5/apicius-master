import axios from 'axios';

// Create an axios instance
const apiClient = axios.create({
    baseURL: 'http://localhost:5010/api', // Adjust based on your backend API base URL
    withCredentials: true, // Ensures cookies are included with requests
});

// Interceptor to handle refreshing tokens
apiClient.interceptors.response.use(
    (response) => response, // Pass through successful responses
    async (error) => {
        if (error.response && error.response.status === 401) {
            try {
                // Attempt to refresh the token
                await axios.post('http://localhost:5010/api/users/refresh-token', {}, { withCredentials: true });
                // Retry the original request
                return apiClient(error.config);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                // Redirect to login if refresh fails
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;