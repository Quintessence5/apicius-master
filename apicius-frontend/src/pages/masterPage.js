import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import HamburgerMenu from "../components/hamburgerMenu";
import logo from "../assets/images/apicius-icon.png";
import "../App.css";

const MasterPage = ({ children }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState({ username: "User", role: "user" });

    useEffect(() => {
        let refreshInterval = null;

        const scheduleTokenRefresh = () => {
            refreshInterval = setInterval(async () => {
                try {
                    console.log("Refreshing access token...");
                    const refreshToken = localStorage.getItem('refreshToken');
                    const response = await apiClient.post('/users/refresh-token', { refreshToken });
                    const { accessToken, refreshToken: newRefreshToken } = response.data;

                    // Update tokens in localStorage
                    localStorage.setItem('accessToken', accessToken);
                    localStorage.setItem('refreshToken', newRefreshToken);
                } catch (error) {
                    console.error('Token refresh failed:', error);
                    if (error.response?.status === 401) {
                        navigate('/login');
                    }
                }
            }, 10 * 60 * 1000);
        };

        const fetchInitialData = async () => {
            try {
                console.log("Fetching profile...");
                const userResponse = await apiClient.get("/users/profile");
                console.log("Profile response:", userResponse.data);
                setUser({
                    username: userResponse.data.username || "User",
                    role: userResponse.data.role || "user"});
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                if (error.response?.status === 401) {
                    console.log("Unauthorized. Redirecting to login...");
                    navigate("/login");
                }
            }
        };

        fetchInitialData(); 
        scheduleTokenRefresh();

        return () => {
            if (refreshInterval) clearInterval(refreshInterval);
        };
    }, [navigate]);

    const handleLogout = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            await apiClient.post('/users/logout', { refreshToken });
            clearInterval(window.refreshInterval);
            window.localStorage.clear();
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
                <HamburgerMenu user={user} handleLogout={handleLogout} />
            </header>

            {/* Main Content Area */}
            <main className="main-content">
                <Outlet /> {/* Renders child components */}
            </main>
        </div>
    );
};

export default MasterPage;