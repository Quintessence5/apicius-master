import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MasterPage from './pages/masterPage';
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
    const scheduleTokenRefresh = () => {
        const interval = setInterval(async () => {
            try {
                console.log("Proactively refreshing tokens...");
                await apiClient.post('/users/refresh-token');
                console.log("Tokens refreshed successfully.");
            } catch (error) {
                console.error("Failed to refresh tokens:", error);
                clearInterval(interval); // Stop refresh attempts on failure
                if (error.response?.status === 401) {
                    console.warn("Session expired, redirecting to login.");
                    window.location.href = '/login'; // Redirect to login if refresh fails
                }
            }
        }, 10 * 60 * 1000); // Refresh every 10 minutes
    
        return () => clearInterval(interval); // Cleanup on unmount
    };
    
    // Initialize on load
    useEffect(() => {
        const clearRefresh = scheduleTokenRefresh();
        return clearRefresh; // Cleanup on unmount
    }, []);

    return (
        <Router>
            <Routes>
                <Route path="/register" element={<Register />} />
                <Route path="/registerForm" element={<RegisterForm />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                
                <Route element={<MasterPage />}>
                    <Route path="/dashboard" element={<ProtectedRoute> <Dashboard /> </ProtectedRoute>} />
                    <Route path="/profile" element={ <ProtectedRoute> <Profile /> </ProtectedRoute> } />
                    <Route path="/add-recipe" element={ <ProtectedRoute>  <AddRecipe /> </ProtectedRoute> } />
                    <Route path="/all-recipes" element={ <ProtectedRoute> <AllRecipes /> </ProtectedRoute> } />
                </Route>
            </Routes>
        </Router>
    );
};

export default App;
