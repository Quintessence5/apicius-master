import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ user, loading, children }) => {
    console.log('ProtectedRoute - User:', user);
    console.log('ProtectedRoute - Loading:', loading);

    // If still loading, do not render anything
    if (loading) {
        return null; // Or return a loading spinner
    }

    // Check for accessToken in localStorage
    const accessToken = localStorage.getItem('accessToken');

    // If the user is not authenticated, redirect to the login page
    if (!accessToken) {
        console.log('User not authenticated. Redirecting to login...');
        return <Navigate to="/login" />;
    }

    // If the user is authenticated, render the children (protected content)
    return children;
};

export default ProtectedRoute;