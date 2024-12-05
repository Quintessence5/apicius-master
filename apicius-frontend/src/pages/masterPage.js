import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import logo from "../assets/images/apicius-icon.png";
import "../App.css";

const MasterPage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const scheduleTokenRefresh = () => {
            const interval = setInterval(async () => {
                try {
                    console.log("Proactively refreshing tokens...");
                    await apiClient.post("/users/refresh-token");
                } catch (error) {
                    console.error("Token refresh failed:", error);
                    if (error.response?.status === 401) {
                        console.warn("Session expired. Redirecting to login.");
                        navigate("/login");
                    }
                }
            }, 10 * 60 * 1000); // Refresh every 10 minutes

            return () => clearInterval(interval);
        };

        const refreshOnFocus = () => {
            window.addEventListener("focus", async () => {
                try {
                    await apiClient.post("/users/refresh-token");
                } catch (error) {
                    console.error("Failed to refresh tokens on focus:", error);
                }
            });
        };

        scheduleTokenRefresh();
        refreshOnFocus();
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
                <button className="header-btn" onClick={handleLogout}>
                    Logout
                </button>
            </header>

            {/* Main Content Area */}
            <main className="main-content">
                <Outlet /> {/* Renders child components */}
            </main>
        </div>
    );
};

export default MasterPage;
