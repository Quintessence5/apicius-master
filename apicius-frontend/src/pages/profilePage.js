import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from '../assets/images/apicius-icon.png'; // Adjust path as needed
import '../App.css'; // Assuming you have header styles

const ProfilePage = () => {
    const [userProfile, setUserProfile] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await axios.get('http://localhost:5010/api/users/profile', {
                    withCredentials: true, // Include cookies in the request
                });
                setUserProfile(response.data); // Assuming API returns user profile data
            } catch (error) {
                console.error('Error fetching profile:', error);
                if (error.response && error.response.status === 401) {
                    setErrorMessage('Unauthorized: Please log in again.');
                    navigate('/login'); // Redirect to login if unauthorized
                } else {
                    setErrorMessage('Failed to load profile.');
                }
            }
        };

        fetchProfile();
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

            {/* Profile Page Content */}
            {/* Profile Page Content */}
            <div className="main-content">
                <h1>Welcome to Your Profile</h1>
                {errorMessage && <p className="error-message">{errorMessage}</p>}

                {userProfile ? (
                    <div className="profile-info">
                        <h2>Your Details</h2>
                        <p><strong>Username:</strong> {userProfile.username}</p>
                        <p><strong>Email:</strong> {userProfile.email}</p>
                        <p><strong>Joined on:</strong> {new Date(userProfile.createdAt).toLocaleDateString()}</p>
                    </div>
                ) : (
                    <p>Loading profile...</p>
                )}

                <button className="header-btn" onClick={() => navigate('/Dashboard')}>Go to Dashboard</button>
            </div>
        </div>
    );
};

export default ProfilePage;
