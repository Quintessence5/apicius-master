import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'http://localhost:5010/api', // Adjust based on your backend API base URL
    withCredentials: true, // Ensures cookies are included with requests
});

// Add a response interceptor to handle refreshing tokens
apiClient.interceptors.response.use(
    (response) => response, // Pass successful responses
    (error) => {
        // Handle errors normally without looping or refreshing
        return Promise.reject(error);
    }
);


export default apiClient;
