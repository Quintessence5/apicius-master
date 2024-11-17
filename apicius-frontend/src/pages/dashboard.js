import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard = () => {
    const [message, setMessage] = useState('');

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
            <h1>Dashboard</h1>
            <p>{message || 'Loading...'}</p>
        </div>
    );
};

export default Dashboard;
