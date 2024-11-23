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
    
    // Api Calls when 401
    useEffect(() => {
        const refreshTokens = async () => {
            try {
                console.log('Refreshing tokens on app load...');
                await apiClient.post('/users/refresh-token'); // Trigger refresh token endpoint
            } catch (error) {
                console.error('Error refreshing tokens on app load:', error);
                // Redirect to login if refresh fails
                if (error.response && error.response.status === 401) {
                    window.location.href = '/login';
                }
            }
        };

        refreshTokens();
    }, []);

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
