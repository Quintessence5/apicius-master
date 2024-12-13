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
        const scheduleTokenRefresh = () => {
            const interval = setInterval(async () => {
                try {
                    const response = await apiClient.post('/users/refresh-token');
                    setAccessToken(response.data.accessToken); // Store new access token
                    } catch (error) {
                    console.error('Token refresh failed:', error);
                    if (error.response?.status === 401) {
                        navigate('/login');
                    }
                }
            }, 10 * 60 * 1000); // Refresh every 10 minutes

            return () => clearInterval(interval);
        };

        const fetchInitialData = async () => {
            try {
                // Fetch and set the access token
                const tokenResponse = await apiClient.post("/users/refresh-token");
                setAccessToken(tokenResponse.data.accessToken);

                // Fetch the username
                const userResponse = await apiClient.get("/users/profile");
                setUsername(userResponse.data.username || "User"); // Default to "User" if no username is returned
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                if (error.response?.status === 401) {
                    navigate("/login");
                }
            }
        };

        fetchInitialData();
        const clearRefresh = scheduleTokenRefresh();

        return clearRefresh;
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await apiClient.post('/users/logout');
            clearInterval(window.refreshInterval); // Clear the refresh interval
            window.localStorage.clear(); // Clear storage if used
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
