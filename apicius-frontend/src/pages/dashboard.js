import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    // Fetch user profile data
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const response = await apiClient.get('/users/profile');
                console.log('Fetched user profile:', response.data);
                setUser(response.data);
            } catch (error) {
                console.error('Error fetching user profile:', error);
                navigate('/login');
            }
        };
        const checkProfileCompletion = async () => {
            try {
                const response = await apiClient.get('/api/users/profile', {
                    withCredentials: true,
                });

                if (!response.data.isProfileComplete) {
                    navigate('/registerForm', { state: { userId: response.data.userId } });
                }
            } catch (error) {
                console.error('Error checking profile completion:', error);
            }
        };

        checkProfileCompletion();
        fetchUserProfile();
    }, [navigate]);

    return (
        <div className="dashboard">
            <h1>Welcome to the Dashboard</h1>
            {user?.role === 'admin' && <h2>ADMIN</h2>}
            <p>Hello, {user?.username || 'User'}!</p>
        </div>
    );
};

export default Dashboard;