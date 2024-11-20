import React from 'react';
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

const App = () => {
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
