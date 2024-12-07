import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient'; // Import the client

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
    
    return (
        <div>

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
