import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Register from './pages/register';
import RegisterForm from './pages/registerForm';
import Login from './pages/login';
import Dashboard from './pages/dashboard';
import ProtectedRoute from './components/protectedRoute';
import ForgotPassword from './pages/forgotPassword';
import AddRecipe from './pages/addRecipe';
import AllRecipes from './pages/allRecipes';
import Profile from './pages/profilePage';
import apiClient from './services/apiClient';

const App = () => {
    // Helper to calculate time remaining for token expiry
    const getTokenExpiryTime = () => {
        const token = document.cookie.split('; ').find((row) => row.startsWith('accessToken='));
        if (!token) return 0;

        try {
            const payload = JSON.parse(atob(token.split('=')[1].split('.')[1])); // Decode JWT payload
            return payload.exp * 1000 - Date.now();
        } catch (error) {
            console.error('Error decoding token:', error);
            return 0;
        }
    };

    // Schedule proactive token refresh
    const scheduleTokenRefresh = () => {
        const interval = setInterval(async () => {
            const timeRemaining = getTokenExpiryTime();
            if (timeRemaining > 0 && timeRemaining < 5 * 60 * 1000) { // Refresh when < 5 minutes remain
                try {
                    console.log('Refreshing tokens...');
                    await apiClient.post('/users/refresh-token');
                    console.log('Tokens refreshed successfully.');
                } catch (error) {
                    console.error('Error refreshing tokens:', error);
                    clearInterval(interval); // Stop retries on failure
                    window.location.href = '/login'; // Redirect to login
                }
            }
        }, 4 * 60 * 1000); // Check every 4 minutes

        return () => clearInterval(interval); // Cleanup on unmount
    };

    return (
        <Router>
            <Routes>
                <Route path="/register" element={<Register />} />
                <Route path="/registerForm" element={<RegisterForm />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/add-recipe"
                    element={
                        <ProtectedRoute>
                            <AddRecipe />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/all-recipes"
                    element={
                        <ProtectedRoute>
                            <AllRecipes />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </Router>
    );
};

export default App;
