import React, { useEffect, useState } from 'react';
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
import RecipeDetailed from './pages/recipeDetailed';
import IngredientsPage from './pages/ingredientPage';
import SeasonalPage from './pages/seasonalityPage';
import TimerPage from './pages/timer';
import Profile from './pages/profilePage';
import apiClient from './services/apiClient';
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient();

const App = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); 

    // Check for tokens on app load
    useEffect(() => {
        const checkAuth = async () => {
            const accessToken = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');

            console.log('Checking auth...');
            console.log('Access Token:', accessToken);
            console.log('User ID:', userId);

            if (accessToken && userId) {
                setUser({ userId, accessToken });

                try {
                    console.log('Calling /users/session-status...');
                    const response = await apiClient.post('/users/session-status', { accessToken });
                    console.log('Session status response:', response.data);

                    if (response.data.message === 'Session active') {
                        console.log('Session is active. Setting user state...');
                        setUser({ userId, accessToken });
                    }
                } catch (error) {
                    console.error('Token verification failed:', error);
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('userId');
                    setUser(null); // Clear user state on failure
                }
            } else {
                console.log('No access token or user ID found in localStorage.');
                setUser(null);
            }

            setLoading(false);
        };

        checkAuth();
    }, []);

    // Schedule token refresh
    useEffect(() => {
        const scheduleTokenRefresh = () => {
            const interval = setInterval(async () => {
                try {
                    console.log("Proactively refreshing tokens...");
                    const refreshToken = localStorage.getItem('refreshToken');
                    const response = await apiClient.post('/users/refresh-token', { refreshToken });
                    const { accessToken, refreshToken: newRefreshToken } = response.data;

                    // Update tokens in localStorage
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', newRefreshToken);

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

        const clearRefresh = scheduleTokenRefresh();
        return clearRefresh; // Cleanup on unmount
    }, []);

    // Show a loading indicator while checking authentication
    if (loading) {
        return <p>Loading...</p>;
    }

    return (
        <QueryClientProvider client={queryClient}>
        <Router>
            <Routes>
                <Route path="/register" element={<Register />} />
                <Route path="/registerForm" element={<RegisterForm />} />
                <Route path="/login" element={<Login setUser={setUser} />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                
                <Route element={<MasterPage />}>
                    <Route path="/dashboard" element={<ProtectedRoute user={user} loading={loading}> <Dashboard /> </ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute user={user} loading={loading}> <Profile /> </ProtectedRoute>} />
                    <Route path="/add-recipe" element={<ProtectedRoute user={user} loading={loading}> <AddRecipe /> </ProtectedRoute>} />
                    <Route path="/all-recipes" element={<ProtectedRoute user={user} loading={loading}> <AllRecipes /> </ProtectedRoute>} />
                    <Route path="/recipe/:id" element={<ProtectedRoute user={user} loading={loading}> <RecipeDetailed /> </ProtectedRoute>} />
                    <Route path="/ingredients/*" element={<ProtectedRoute user={user} loading={loading} ><IngredientsPage /></ProtectedRoute>  } />
                    <Route path="/seasons/*" element={<ProtectedRoute user={user} loading={loading} ><SeasonalPage /></ProtectedRoute>  } />
                    <Route path="/timer" element={<ProtectedRoute user={user} loading={loading}> <TimerPage /> </ProtectedRoute>} />
                </Route>
            </Routes>
        </Router></QueryClientProvider>
    );
};

export default App;