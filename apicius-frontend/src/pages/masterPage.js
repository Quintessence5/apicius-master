import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import apiClient, { setAccessToken } from "../services/apiClient";
import HamburgerMenu from "../components/hamburgerMenu";
import logo from "../assets/images/apicius-icon.png";
import "../App.css";

const MasterPage = ({ children }) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("User"); // Default to "User"

    useEffect(() => {
        let refreshInterval = null;
    
        const scheduleTokenRefresh = () => {
            refreshInterval = setInterval(async () => {
                try {
                    console.log("Refreshing access token...");
                    const response = await apiClient.post('/users/refresh-token');
                    setAccessToken(response.data.accessToken); // Update token
                } catch (error) {
                    console.error('Token refresh failed:', error);
                    if (error.response?.status === 401) {
                        navigate('/login'); // Redirect on failure
                    }
                }
            }, 10 * 60 * 1000); // Refresh every 10 minutes
        };
    
        const fetchInitialData = async () => {
            try {
                console.log("Fetching profile...");
                const userResponse = await apiClient.get("/users/profile");
                setUsername(userResponse.data.username || "User");
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                if (error.response?.status === 401) {
                    navigate("/login");
                }
            }
        };        
    
        fetchInitialData(); // Fetch initial token and data
        scheduleTokenRefresh(); // Start refresh interval

    return () => {
        if (refreshInterval) clearInterval(refreshInterval); // Clean up interval
    };
}, [navigate]);

const handleLogout = async () => {
    try {
        await apiClient.post('/users/logout');
        clearInterval(window.refreshInterval); // Clear any active intervals
        window.localStorage.clear(); // Clear storage
        window.location.href = '/login';
    } catch (error) {
        console.error('Error logging out:', error);
    }
};

    return (
        <div className="master-page">
            {/* Header */}
            <header className="header">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                {/* Hamburger Menu */}
                <HamburgerMenu username={username} handleLogout={handleLogout} />
            </header>

            {/* Main Content Area */}
            <main className="main-content">
                <Outlet /> {/* Renders child components */}
            </main>
        </div>
    );
};

export default MasterPage;
