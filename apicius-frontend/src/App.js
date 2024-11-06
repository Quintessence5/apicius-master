import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Register from './pages/register';
import Login from './pages/login';
import Dashboard from './pages/dashboard';
import PrivateRoute from './components/privateRoute';
import ForgotPassword from './pages/forgotPassword';
import AddRecipe from './pages/addRecipe';


const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} /> {/* Redirect to Login page */}
                <Route path="/register" element={<Register />} />
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

                {/* Additional protected route */}
                <Route 
                    path="/add-recipe" 
                    element={
                        <PrivateRoute>
                            <AddRecipe />
                        </PrivateRoute>
                    } 
                />
            </Routes>
        </Router>
    );
};

export default App;