import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from '../assets/images/apicius-icon.png'; // Adjust path as needed
import '../App.css'; // Assuming you have header styles

const Dashboard = () => {
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await axios.get('http://localhost:5010/api/users/dashboard', {
                    withCredentials: true, // Include cookies in the request
                });
                setMessage(response.data.message);
            } catch (error) {
                console.error('Error fetching dashboard:', error);
                setMessage('Failed to load dashboard');
            }
        };
        fetchDashboard();
    }, []);

    return (
        <div>
            {/* Header */}
            <header className="header">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                <button className="header-btn" onClick={() => navigate('/login')}>Logout</button>
            </header>

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
