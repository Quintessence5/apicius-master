// src/components/PrivateRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
    // Check for token in localStorage
    const token = localStorage.getItem('token');

    // If no token, redirect to login
    return token ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
