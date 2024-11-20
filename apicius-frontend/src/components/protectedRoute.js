import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

const ProtectedRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null); // `null` indicates loading state

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await axios.get('http://localhost:5010/api/users/dashboard', {
                    withCredentials: true, // Include cookies in the request
                });
                setIsAuthenticated(true);
            } catch (error) {
                setIsAuthenticated(false); // Unauthorized or error occurred
            }
        };

        checkAuth();
    }, []);

    if (isAuthenticated === null) {
        return <div>Loading...</div>; // Show a loading state while checking authentication
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
