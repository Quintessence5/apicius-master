import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import apiClient from '../services/apiClient'; // Import the client
import HamburgerMenu from '../components/hamburgerMenu';


import logo from '../assets/images/apicius-icon.png'; // Adjust path as needed
import '../App.css'; // Assuming you have header styles

// Dashboard Logic
const Dashboard = () => {
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                // Use apiClient to make a GET request
                const response = await apiClient.get('/users/dashboard');
                setMessage(response.data.message);
            } catch (error) {
                console.error('Error fetching dashboard:', error);
                if (error.response && error.response.status === 401) {
                    setMessage('Unauthorized: Please log in again.');
                    navigate('/login');
                } else {
                    setMessage('Failed to load dashboard');
                }
            }
        };

        fetchDashboard();
    }, [navigate]);

// Logout function
 const handleLogout = async () => {
        try {
            await axios.post('http://localhost:5010/api/users/logout', {}, { withCredentials: true });
            navigate('/login'); // Redirect to login page
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };
    

    return (
        <div>
            {/* Header */}
            <header className="header">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                <button className="header-btn" onClick={handleLogout}>Logout</button>
            </header>

            <HamburgerMenu/>

            {/* Dashboard Content */}
            <div className="main-content">
                <h1>Dashboard</h1>
                <p>{message || 'Loading...'}</p>
                <button className="header-btn" onClick={() => navigate('/profile')}>Go to Profile Page</button>
            </div>
        </div>
    );
};

export default Dashboard;
