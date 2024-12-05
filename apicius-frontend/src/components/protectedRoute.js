import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

const ProtectedRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false); // `null` indicates loading state
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            try {
                await apiClient.get('/users/session-status');
                setIsAuthenticated(true);
            } catch (error) {
                console.error("Session invalid:", error);
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, []);

    if (isLoading) return <p>Loading...</p>;

    return isAuthenticated ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
