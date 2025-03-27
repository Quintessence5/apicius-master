import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ user, loading, children, adminOnly }) => {
    console.log('ProtectedRoute - User:', user);
    console.log('ProtectedRoute - Loading:', loading);

    // If still loading, do not render anything
    if (loading) {
        return null; 
    }

    // Check for accessToken in localStorage
    const accessToken = localStorage.getItem('accessToken');

    // If the user is not authenticated
    if (!accessToken) {
        console.log('User not authenticated. Redirecting to login...');
        return <Navigate to="/login" />;
    }

    // If admin-only route check
    if (adminOnly) {
        const isAdmin = user?.role === 'admin';
        console.log(`Admin check: ${isAdmin ? 'Granted' : 'Denied'}`);
        
        if (!isAdmin) {
            console.log('Admin access required. Redirecting...');
            return <Navigate to="/dashboard" />;
        }
    }

    // If all checks pass, render children
    return children;
};

export default ProtectedRoute;