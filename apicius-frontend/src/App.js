import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Register from './pages/register';
import RegisterForm from './pages/registerForm';
import Login from './pages/login';
import Dashboard from './pages/dashboard';
import PrivateRoute from './components/privateRoute';
import ForgotPassword from './pages/forgotPassword';
import AddRecipe from './pages/addRecipe';
import AllRecipes from './pages/allRecipes';

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
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/add-recipe"
                    element={
                        <PrivateRoute>
                            <AddRecipe />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/all-recipes"
                    element={
                        <PrivateRoute>
                            <AllRecipes />
                        </PrivateRoute>
                    }
                />
            </Routes>
        </Router>
    );
};

export default App;
