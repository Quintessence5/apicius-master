import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/images/apicius-icon.png'; // Adjust path as needed
import '../App.css'; // Assuming you have header styles

const ProfilePage = () => {
    const navigate = useNavigate();

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

            {/* Profile Page Content */}
            <div className="main-content">
                <h1>Welcome to Your Profile</h1>
                <p>This is your basic profile page. Functionalities will be added later.</p>
                <button className="header-btn" onClick={() => navigate('/Dashboard')}>Go to Dashboard</button>

            </div>
        </div>
    );
};

export default ProfilePage;
